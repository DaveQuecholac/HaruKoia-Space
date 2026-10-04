/**
 * El túnel completo, con sockets reales y un host simulado.
 *
 * Lo que **no** cubre, a propósito: el cruce de NAT entre dos redes distintas.
 * Eso es el checkpoint 2 y es una prueba manual, porque aquí todo corre en la
 * misma máquina y por tanto no demuestra nada sobre el router de nadie.
 */

import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import {
  type IdentidadDeSala,
  type IdentificadorDeConexion,
  type MensajeDeControl,
  RUTAS,
  type Ticket,
  generarIdentidadDeSala,
  generarTicket,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import { crearRegistro } from '@harukoia/registro';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { montarTunel, type Tunel } from './tunel.ts';

const CADUCIDAD = 300;

let servidor: Server;
let tunel: Tunel;
let base: string;
let abiertos: WebSocket[];

beforeEach(async () => {
  abiertos = [];
  servidor = createServer();
  tunel = montarTunel(servidor, {
    registro: crearRegistro({ proceso: 'orquestador', destino: () => {} }),
    caducidadDelEmparejamiento: CADUCIDAD,
  });

  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string') throw new Error('sin puerto');
  base = `ws://127.0.0.1:${direccion.port}`;
});

afterEach(async () => {
  for (const socket of abiertos) socket.close();
  tunel.desmontar();
  await new Promise<void>((listo) => servidor.close(() => listo()));
});

function conectar(ruta: string): Promise<WebSocket> {
  const socket = new WebSocket(`${base}${ruta}`);
  abiertos.push(socket);
  return new Promise((resolver, rechazar) => {
    socket.once('open', () => resolver(socket));
    socket.once('error', rechazar);
  });
}

/** Espera el siguiente mensaje de control y lo interpreta. */
function siguienteControl(socket: WebSocket): Promise<MensajeDeControl> {
  return new Promise((resolver, rechazar) => {
    socket.once('message', (bytes: Buffer) => {
      const leido = interpretarControl(bytes.toString('utf8'));
      if (!leido.ok) {
        rechazar(new Error(`control ilegible: ${leido.detalle}`));
        return;
      }
      resolver(leido.mensaje);
    });
  });
}

function siguienteBinario(socket: WebSocket): Promise<Buffer> {
  return new Promise((resolver) => {
    socket.once('message', (bytes: Buffer) => resolver(bytes));
  });
}

function cierre(socket: WebSocket): Promise<number> {
  return new Promise((resolver) => socket.once('close', (codigo) => resolver(codigo)));
}

/** Host simulado: se registra y queda esperando avisos de invitados. */
async function hostRegistrado(identidad: IdentidadDeSala) {
  const control = await conectar(RUTAS.control);
  control.send(
    serializarControl({
      tipo: 'registrar',
      sala: identidad.sala,
      tokenDeHost: identidad.tokenDeHost,
      tokenDeInvitacion: identidad.tokenDeInvitacion,
    }),
  );

  const respuesta = await siguienteControl(control);
  expect(respuesta.tipo).toBe('registro-aceptado');
  return control;
}

/** Un invitado que presenta su token y espera a que lo emparejen. */
async function invitadoEntrando(identidad: IdentidadDeSala, token = identidad.tokenDeInvitacion) {
  const invitado = await conectar(RUTAS.invitado);
  invitado.send(
    serializarControl({ tipo: 'entrar', sala: identidad.sala, tokenDeInvitacion: token }),
  );
  return invitado;
}

/** El host abre su conexión de datos y devuelve el ticket. */
async function datosDelHost(conexion: IdentificadorDeConexion, ticket: Ticket) {
  const datos = await conectar(RUTAS.datos);
  datos.send(serializarControl({ tipo: 'emparejar', conexion, ticket }));
  return datos;
}

/** Datos del host con ticket válido: lo primero que recibe es la aceptación. */
async function datosEmparejados(conexion: IdentificadorDeConexion, ticket: Ticket) {
  const datos = await datosDelHost(conexion, ticket);
  expect(await siguienteControl(datos)).toEqual({ tipo: 'emparejamiento-aceptado', conexion });
  return datos;
}

/** El recorrido completo: invitado dentro y las dos puntas unidas. */
async function salaConUnInvitado(identidad: IdentidadDeSala) {
  const control = await hostRegistrado(identidad);
  const esperaAviso = siguienteControl(control);
  const invitado = await invitadoEntrando(identidad);

  const aviso = await esperaAviso;
  if (aviso.tipo !== 'entra-invitado') throw new Error(`se esperaba el aviso: ${aviso.tipo}`);

  const aceptacion = siguienteControl(invitado);
  const datos = await datosEmparejados(aviso.conexion, aviso.ticket);
  expect((await aceptacion).tipo).toBe('entrada-aceptada');

  return { control, invitado, datos, conexion: aviso.conexion };
}

describe('registro del host por la conexión de control', () => {
  it('acepta un host nuevo', async () => {
    const identidad = generarIdentidadDeSala();

    await hostRegistrado(identidad);

    expect(tunel.salas.salasVivas()).toBe(1);
  });

  it('rechaza con causa a otro host que reclama la misma sala', async () => {
    const identidad = generarIdentidadDeSala();
    await hostRegistrado(identidad);
    const intruso = generarIdentidadDeSala();

    const control = await conectar(RUTAS.control);
    control.send(
      serializarControl({
        tipo: 'registrar',
        sala: identidad.sala,
        tokenDeHost: intruso.tokenDeHost,
        tokenDeInvitacion: intruso.tokenDeInvitacion,
      }),
    );

    const respuesta = await siguienteControl(control);

    expect(respuesta).toEqual({
      tipo: 'registro-rechazado',
      causa: 'sala-ocupada-por-otro-host',
    });
  });

  it('un primer mensaje que no es registro se rechaza y se cierra', async () => {
    const control = await conectar(RUTAS.control);
    control.send(serializarControl({ tipo: 'latido' }));

    const respuesta = await siguienteControl(control);

    expect(respuesta.tipo).toBe('entrada-rechazada');
    expect(await cierre(control)).toBe(1008);
  });

  it('una ruta que no es del relay falla de inmediato, sin dejar el socket colgado', async () => {
    await expect(conectar('/ruta/que-no-existe')).rejects.toThrow(/404/);
  });

  it('basura como primer mensaje se rechaza con causa', async () => {
    const control = await conectar(RUTAS.control);
    control.send('{no soy json');

    const respuesta = await siguienteControl(control);

    expect(respuesta).toEqual({ tipo: 'entrada-rechazada', causa: 'mensaje-mal-formado' });
  });
});

describe('entrada del invitado', () => {
  it('rechaza un token de invitación equivocado', async () => {
    const identidad = generarIdentidadDeSala();
    await hostRegistrado(identidad);
    const otra = generarIdentidadDeSala();

    const invitado = await invitadoEntrando(identidad, otra.tokenDeInvitacion);
    const respuesta = await siguienteControl(invitado);

    expect(respuesta).toEqual({
      tipo: 'entrada-rechazada',
      causa: 'token-de-invitacion-invalido',
    });
  });

  it('rechaza una sala que no existe', async () => {
    const identidad = generarIdentidadDeSala();

    const invitado = await invitadoEntrando(identidad);
    const respuesta = await siguienteControl(invitado);

    expect(respuesta).toEqual({ tipo: 'entrada-rechazada', causa: 'sala-no-encontrada' });
  });

  it('avisa al host con conexión y ticket', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);

    const espera = siguienteControl(control);
    await invitadoEntrando(identidad);
    const aviso = await espera;

    expect(aviso.tipo).toBe('entra-invitado');
    if (aviso.tipo === 'entra-invitado') {
      expect(aviso.canal).toBe('sesion');
      expect(aviso.ticket).toHaveLength(26);
    }
  });

  it('si el host no abre la conexión de datos, el invitado recibe la causa', async () => {
    const identidad = generarIdentidadDeSala();
    await hostRegistrado(identidad);

    const invitado = await invitadoEntrando(identidad);
    const respuesta = await siguienteControl(invitado);

    expect(respuesta).toEqual({
      tipo: 'entrada-rechazada',
      causa: 'emparejamiento-expirado',
    });
  }, 10_000);
});

describe('emparejamiento de las dos puntas', () => {
  it('rechaza un ticket inventado', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);
    const espera = siguienteControl(control);
    await invitadoEntrando(identidad);
    const aviso = await espera;
    if (aviso.tipo !== 'entra-invitado') throw new Error('sin aviso');

    const datos = await datosDelHost(aviso.conexion, generarTicket());
    const respuesta = await siguienteControl(datos);

    expect(respuesta).toEqual({ tipo: 'emparejamiento-rechazado', causa: 'ticket-invalido' });
  });

  it('un ticket no se puede usar dos veces', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);
    const espera = siguienteControl(control);
    await invitadoEntrando(identidad);
    const aviso = await espera;
    if (aviso.tipo !== 'entra-invitado') throw new Error('sin aviso');

    await datosDelHost(aviso.conexion, aviso.ticket);
    const segunda = await datosDelHost(aviso.conexion, aviso.ticket);
    const respuesta = await siguienteControl(segunda);

    expect(respuesta).toEqual({ tipo: 'emparejamiento-rechazado', causa: 'ticket-invalido' });
  });
});

describe('los bytes cruzan', () => {
  it('del invitado al host, idénticos', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);
    const enviado = randomBytes(2048);

    const recibido = siguienteBinario(datos);
    invitado.send(enviado, { binary: true });

    expect(Buffer.compare(await recibido, enviado)).toBe(0);
  });

  it('del host al invitado, idénticos', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);
    const enviado = randomBytes(2048);

    const recibido = siguienteBinario(invitado);
    datos.send(enviado, { binary: true });

    expect(Buffer.compare(await recibido, enviado)).toBe(0);
  });

  it('un mensaje grande llega sin alterarse', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);
    const enviado = randomBytes(512 * 1024);

    const recibido = siguienteBinario(datos);
    invitado.send(enviado, { binary: true });

    expect(Buffer.compare(await recibido, enviado)).toBe(0);
  }, 10_000);

  it('el orquestador no interpreta lo que transporta', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);

    // Bytes que parecen un mensaje de control: deben pasar tal cual.
    const enviado = Buffer.from(serializarControl({ tipo: 'cerrar-sala' }));

    const recibido = siguienteBinario(datos);
    invitado.send(enviado, { binary: true });

    expect(Buffer.compare(await recibido, enviado)).toBe(0);
    expect(tunel.salas.salasVivas()).toBe(1);
  });
});

describe('diez invitados a la vez', () => {
  it('ningún mensaje llega a quien no era', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);

    const avisos: Array<Extract<MensajeDeControl, { tipo: 'entra-invitado' }>> = [];
    control.on('message', (bytes: Buffer) => {
      const leido = interpretarControl(bytes.toString('utf8'));
      if (leido.ok && leido.mensaje.tipo === 'entra-invitado') avisos.push(leido.mensaje);
    });

    const invitados = await Promise.all(
      Array.from({ length: 10 }, () => invitadoEntrando(identidad)),
    );

    await new Promise((listo) => setTimeout(listo, 150));
    expect(avisos).toHaveLength(10);

    // Cada punta de datos se queda con la carga de su invitado.
    const parejas = await Promise.all(
      avisos.map(async (aviso, i) => ({
        datos: await datosEmparejados(aviso.conexion, aviso.ticket),
        carga: Buffer.from(`soy el invitado numero ${i}`.padEnd(64, '.')),
      })),
    );

    const recibidos = parejas.map(({ datos }) => siguienteBinario(datos));
    for (const invitado of invitados) {
      const indice = invitados.indexOf(invitado);
      invitado.send(parejas[indice]!.carga, { binary: true });
    }

    const llegados = await Promise.all(recibidos);
    const esperados = parejas.map(({ carga }) => carga.toString());

    // Cada carga llegó exactamente una vez, y a una sola punta.
    expect(llegados.map((bytes) => bytes.toString()).sort()).toEqual(esperados.sort());
  }, 15_000);
});

describe('cierres', () => {
  it('cerrar el invitado cierra su conexión de datos', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);

    const cerrada = cierre(datos);
    invitado.close(1000);

    await cerrada;
    expect(datos.readyState).toBe(WebSocket.CLOSED);
  });

  it('cerrar la punta del host cierra al invitado', async () => {
    const identidad = generarIdentidadDeSala();
    const { invitado, datos } = await salaConUnInvitado(identidad);

    const cerrada = cierre(invitado);
    datos.close(1000);

    await cerrada;
    expect(invitado.readyState).toBe(WebSocket.CLOSED);
  });

  it('el host se entera de que el invitado salió', async () => {
    const identidad = generarIdentidadDeSala();
    const { control, invitado, conexion } = await salaConUnInvitado(identidad);

    const aviso = siguienteControl(control);
    invitado.close(1000);

    expect(await aviso).toEqual({ tipo: 'sale-invitado', conexion });
  });

  it('no quedan emparejamientos pendientes después del recorrido', async () => {
    const identidad = generarIdentidadDeSala();
    await salaConUnInvitado(identidad);

    expect(tunel.emparejamientosPendientes()).toBe(0);
  });

  it('un invitado que se va antes de emparejarse no deja pendiente', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);
    const espera = siguienteControl(control);
    const invitado = await invitadoEntrando(identidad);
    await espera;

    invitado.close(1000);
    await new Promise((listo) => setTimeout(listo, 100));

    expect(tunel.emparejamientosPendientes()).toBe(0);
  });

  it('cerrar la sala echa a los que estaban esperando', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);
    const espera = siguienteControl(control);
    const invitado = await invitadoEntrando(identidad);
    await espera;

    const respuesta = siguienteControl(invitado);
    control.send(serializarControl({ tipo: 'cerrar-sala' }));

    expect(await respuesta).toEqual({
      tipo: 'entrada-rechazada',
      causa: 'sala-no-encontrada',
    });
    expect(tunel.salas.salasVivas()).toBe(0);
  });
});

describe('el latido mantiene la sala', () => {
  it('un latido por la conexión de control no la tira', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);

    control.send(serializarControl({ tipo: 'latido' }));
    await new Promise((listo) => setTimeout(listo, 50));

    expect(tunel.salas.salasVivas()).toBe(1);
  });

  it('un mensaje desconocido por control se rechaza con causa, sin cerrar la sala', async () => {
    const identidad = generarIdentidadDeSala();
    const control = await hostRegistrado(identidad);

    const respuesta = siguienteControl(control);
    control.send(JSON.stringify({ tipo: 'bailar' }));

    expect(await respuesta).toEqual({
      tipo: 'registro-rechazado',
      causa: 'mensaje-no-reconocido',
    });
    expect(tunel.salas.salasVivas()).toBe(1);
  });
});
