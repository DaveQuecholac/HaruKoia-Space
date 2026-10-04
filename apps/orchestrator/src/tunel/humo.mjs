/**
 * Arnés del **checkpoint 2**: prueba que el túnel cruza entre dos redes.
 *
 * El plan coloca este checkpoint antes de B4 a propósito, así que aquí los dos
 * extremos son scripts: el host real todavía no existe. Lo único que se prueba
 * es lo que la arquitectura da por supuesto — que una máquina sin puertos
 * abiertos queda alcanzable porque marca hacia fuera.
 *
 * Se importa el contrato de `@harukoia/domain` en lugar de copiarlo: si el
 * protocolo cambia, este arnés se rompe en vez de mentir.
 *
 * Dos modos, uno en cada red:
 *
 *   node humo.mjs host      wss://orquestador.ejemplo.com
 *   node humo.mjs invitado  wss://orquestador.ejemplo.com <sala> <token>
 *
 * El modo host imprime el comando del invitado, ya armado, para copiarlo.
 *
 * Variables opcionales:
 *   SEGUNDOS=60   cuánto aguanta abierta la conexión antes del veredicto
 *   NODE_EXTRA_CA_CERTS=/ruta/ca.pem   para un TLS que no sea de una CA pública
 */

import { randomBytes } from 'node:crypto';

import { generarIdentidadDeSala, interpretarControl, RUTAS, serializarControl } from '@harukoia/domain';
import { WebSocket } from 'ws';

const SEGUNDOS = Number(process.env.SEGUNDOS ?? 60);
const MILISEGUNDOS_ENTRE_PULSOS = 5_000;
const BYTES_DEL_BLOQUE_GRANDE = 512 * 1024;
const MILISEGUNDOS_DE_LATIDO = 10_000;

const [modo, base, salaDada, tokenDado] = process.argv.slice(2);

function abortar(mensaje) {
  console.error(`\n  ✗ ${mensaje}\n`);
  process.exit(1);
}

if (modo !== 'host' && modo !== 'invitado') {
  abortar('primer argumento: host o invitado');
}
if (!base) {
  abortar('segundo argumento: la URL del orquestador, por ejemplo wss://orquestador.ejemplo.com');
}

/** Pega la ruta del relay a la URL base, sin importar si trae barra final. */
function url(ruta) {
  return new URL(ruta, base.endsWith('/') ? base : `${base}/`).toString();
}

function ahora() {
  return new Date().toISOString().slice(11, 23);
}

function linea(texto) {
  console.log(`  ${ahora()}  ${texto}`);
}

/** Lee un mensaje de control, o devuelve null si lo que llegó no lo es. */
function control(datos, esBinario) {
  if (esBinario) return null;
  const leido = interpretarControl(datos.toString('utf8'));
  return leido.ok ? leido.mensaje : null;
}

// ---------------------------------------------------------------- modo host

function correrComoHost() {
  const identidad = generarIdentidadDeSala();
  const sesion = new WebSocket(url(RUTAS.control.slice(1)));

  console.log('\n  Modo host. Esta máquina no abre ningún puerto: solo marca hacia fuera.\n');

  sesion.on('open', () => {
    linea('conexión de control abierta');
    sesion.send(serializarControl({ tipo: 'registrar', ...identidad }));
  });

  const latido = setInterval(() => {
    if (sesion.readyState === WebSocket.OPEN) {
      sesion.send(serializarControl({ tipo: 'latido' }));
    }
  }, MILISEGUNDOS_DE_LATIDO);

  sesion.on('message', (datos, esBinario) => {
    const mensaje = control(datos, esBinario);
    if (!mensaje) return;

    if (mensaje.tipo === 'registro-aceptado') {
      linea(`sala registrada: ${mensaje.sala}`);
      console.log('\n  Corre esto en la OTRA red:\n');
      console.log(
        `    node humo.mjs invitado ${base} ${identidad.sala} ${identidad.tokenDeInvitacion}\n`,
      );
      console.log('  Esperando al invitado…\n');
      return;
    }

    if (mensaje.tipo === 'registro-rechazado' || mensaje.tipo === 'entrada-rechazada') {
      abortar(`el orquestador rechazó el registro: ${mensaje.causa}`);
    }

    if (mensaje.tipo === 'sala-cerrada') {
      abortar(`la sala se cerró: ${mensaje.causa}`);
    }

    if (mensaje.tipo === 'entra-invitado') {
      linea(`avisan de un invitado (${mensaje.conexion}) por el canal ${mensaje.canal}`);
      abrirConexionDeDatos(mensaje);
      return;
    }

    if (mensaje.tipo === 'sale-invitado') {
      linea(`el invitado ${mensaje.conexion} se fue`);
    }
  });

  sesion.on('error', (error) => abortar(`la conexión de control falló: ${error.message}`));
  sesion.on('close', (codigo) => {
    clearInterval(latido);
    linea(`conexión de control cerrada (código ${codigo})`);
  });
}

/**
 * Lo que B4 hará de verdad: ante el aviso, abrir una conexión **saliente** de
 * datos y probar con el ticket que viene del host dueño de la sala.
 */
function abrirConexionDeDatos({ conexion, ticket }) {
  const datos = new WebSocket(url(RUTAS.datos.slice(1)));
  let emparejada = false;

  datos.on('open', () => {
    linea('conexión de datos saliente abierta');
    datos.send(serializarControl({ tipo: 'emparejar', conexion, ticket }));
  });

  datos.on('message', (carga, esBinario) => {
    if (!emparejada) {
      const mensaje = control(carga, esBinario);
      if (mensaje?.tipo === 'emparejamiento-rechazado') {
        abortar(`el emparejamiento fue rechazado: ${mensaje.causa}`);
      }
      if (mensaje?.tipo !== 'emparejamiento-aceptado') {
        abortar('el orquestador no confirmó el emparejamiento antes de los datos');
      }
      emparejada = true;
      linea('emparejado: desde aquí solo pasan bytes');
      return;
    }

    // El host hace eco: el invitado comprueba que los bytes vuelven idénticos.
    if (datos.readyState === WebSocket.OPEN) datos.send(carga, { binary: esBinario });
  });

  datos.on('error', (error) => abortar(`la conexión de datos falló: ${error.message}`));
  datos.on('close', (codigo) => linea(`conexión de datos cerrada (código ${codigo})`));
}

// ------------------------------------------------------------ modo invitado

function correrComoInvitado() {
  if (!salaDada || !tokenDado) {
    abortar('faltan argumentos: node humo.mjs invitado <url> <sala> <token>');
  }

  const sesion = new WebSocket(url(RUTAS.invitado.slice(1)));
  const resultados = [];
  let aceptada = false;
  let esperando = null;
  let pulsos = 0;

  console.log('\n  Modo invitado. Esta máquina no sabe dónde está el host ni le hace falta.\n');

  sesion.on('open', () => {
    linea('conexión abierta, pidiendo entrar');
    sesion.send(
      serializarControl({ tipo: 'entrar', sala: salaDada, tokenDeInvitacion: tokenDado }),
    );
  });

  sesion.on('message', (carga, esBinario) => {
    if (!aceptada) {
      const mensaje = control(carga, esBinario);

      if (mensaje?.tipo === 'entrada-rechazada') {
        abortar(`entrada rechazada: ${mensaje.causa}`);
      }
      if (mensaje?.tipo === 'entrada-aceptada') {
        aceptada = true;
        linea(`entrada aceptada (${mensaje.conexion})`);
        resultados.push(['el invitado entra sin conocer al host', true]);
        empezarLosDatos();
      }
      return;
    }

    if (!esperando) return;

    const vueltos = Buffer.from(carga);
    const identicos = vueltos.equals(esperando.enviados);
    const vuelta = Math.round(performance.now() - esperando.inicio);

    linea(
      `${esperando.nombre}: ${identicos ? 'bytes idénticos' : 'BYTES DISTINTOS'}` +
        ` (${vueltos.length} B, ida y vuelta ${vuelta} ms)`,
    );
    resultados.push([`${esperando.nombre} cruza íntegro`, identicos]);
    esperando = null;
  });

  function enviar(nombre, bytes) {
    esperando = { nombre, enviados: bytes, inicio: performance.now() };
    sesion.send(bytes, { binary: true });
  }

  function empezarLosDatos() {
    enviar('bloque de 512 KB', randomBytes(BYTES_DEL_BLOQUE_GRANDE));

    const pulso = setInterval(() => {
      pulsos += 1;
      if (esperando) {
        linea(`AVISO: el pulso anterior (${esperando.nombre}) no volvió`);
      }
      enviar(`pulso ${pulsos}`, randomBytes(64));
    }, MILISEGUNDOS_ENTRE_PULSOS);

    const final = setTimeout(() => {
      clearInterval(pulso);
      veredicto();
    }, SEGUNDOS * 1_000);

    console.log(
      `\n  Manteniendo la conexión ${SEGUNDOS} s, con un pulso cada ${
        MILISEGUNDOS_ENTRE_PULSOS / 1_000
      } s.`,
    );
    console.log('  Si el TLS de en medio corta las conexiones inactivas, aquí se ve.\n');

    sesion.on('close', (codigo) => {
      clearInterval(pulso);
      clearTimeout(final);
      if (codigo !== 1000) {
        linea(`la conexión se cerró sola con código ${codigo}`);
        resultados.push(['la conexión aguanta abierta', false]);
      }
      veredicto();
    });
  }

  function veredicto() {
    const abierta = sesion.readyState === WebSocket.OPEN;
    if (abierta) resultados.push([`la conexión aguanta ${SEGUNDOS} s sin cortes`, true]);

    const pulsosRespondidos = resultados.filter(([n, ok]) => n.startsWith('pulso') && ok).length;

    console.log('\n  ── Veredicto del checkpoint 2 ──\n');
    for (const [nombre, ok] of resultados) {
      console.log(`    ${ok ? '✓' : '✗'}  ${nombre}`);
    }

    const todoBien = resultados.every(([, ok]) => ok) && pulsosRespondidos > 0;
    console.log(
      `\n  ${todoBien ? '✓ El túnel cruza entre las dos redes.' : '✗ El túnel NO cruzó limpio.'}\n`,
    );

    sesion.close(1000);
    process.exit(todoBien ? 0 : 1);
  }

  sesion.on('error', (error) => abortar(`la conexión falló: ${error.message}`));
}

if (modo === 'host') correrComoHost();
else correrComoInvitado();
