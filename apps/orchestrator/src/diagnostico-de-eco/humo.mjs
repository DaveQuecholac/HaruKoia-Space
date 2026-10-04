#!/usr/bin/env node
/**
 * Prueba de humo del paso A3. Verifica contra la URL pública (con TLS y el proxy
 * de desarrollo en medio) que:
 *   1. la conexión WebSocket se establece por el proxy,
 *   2. los mensajes binarios vuelven idénticos byte por byte,
 *   3. una conexión inactiva sobrevive más de un minuto sin que el proxy la corte.
 *
 * Uso: node humo.mjs [url] [--inactividad=75]
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import WebSocket from 'ws';

const URL_POR_DEFECTO = 'wss://orquestador.harukoia.local.iokoia.dev/diagnostico/eco';

const argumentos = process.argv.slice(2);
const url = argumentos.find((a) => !a.startsWith('--')) ?? URL_POR_DEFECTO;
const segundosDeInactividad = Number(
  argumentos.find((a) => a.startsWith('--inactividad='))?.split('=')[1] ?? 75,
);

function autoridadCertificadora() {
  try {
    return readFileSync(join(homedir(), '.portless', 'ca.pem'));
  } catch {
    return undefined;
  }
}

const resultados = [];

function registrar(nombre, correcto, detalle) {
  resultados.push({ nombre, correcto });
  console.log(`${correcto ? '  OK  ' : ' FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

function conectar() {
  const ca = autoridadCertificadora();
  const socket = new WebSocket(url, ca ? { ca } : {});

  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error('tiempo agotado al conectar (10 s)')), 10_000);
    socket.once('open', () => {
      clearTimeout(limite);
      resolver(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(limite);
      rechazar(error);
    });
  });
}

function ecoDe(socket, carga) {
  return new Promise((resolver, rechazar) => {
    const inicio = performance.now();
    const limite = setTimeout(() => rechazar(new Error('tiempo agotado esperando el eco (10 s)')), 10_000);

    socket.once('message', (respuesta) => {
      clearTimeout(limite);
      const vuelta = performance.now() - inicio;
      const buffer = Buffer.isBuffer(respuesta) ? respuesta : Buffer.from(respuesta);
      resolver({ identico: Buffer.compare(buffer, carga) === 0, vuelta, recibidos: buffer.length });
    });

    socket.send(carga, { binary: true }, (error) => {
      if (error) {
        clearTimeout(limite);
        rechazar(error);
      }
    });
  });
}

function esperarInactivo(socket, segundos) {
  return new Promise((resolver) => {
    const inicio = Date.now();
    let cerradoEn = null;

    const alCerrar = (codigo) => {
      cerradoEn = { segundos: Math.round((Date.now() - inicio) / 1000), codigo };
    };

    socket.once('close', alCerrar);
    socket.once('error', () => alCerrar(-1));

    setTimeout(() => {
      socket.off('close', alCerrar);
      resolver(cerradoEn);
    }, segundos * 1000);
  });
}

console.log(`\nHumo A3 — ${url}`);
console.log(`Autoridad certificadora del proxy: ${autoridadCertificadora() ? 'encontrada' : 'no encontrada'}\n`);

let socket;

try {
  const inicio = performance.now();
  socket = await conectar();
  registrar('Conexión establecida por la URL pública', true, `${Math.round(performance.now() - inicio)} ms`);
} catch (error) {
  registrar('Conexión establecida por la URL pública', false, error.message);
  console.log('\nEl proxy no dejó pasar la actualización a WebSocket. El relay no puede construirse así.\n');
  process.exit(1);
}

for (const bytes of [8, 1024, 64 * 1024, 512 * 1024]) {
  const carga = randomBytes(bytes);
  try {
    const { identico, vuelta, recibidos } = await ecoDe(socket, carga);
    registrar(
      `Eco binario de ${bytes.toLocaleString('es-MX')} bytes`,
      identico,
      identico ? `${vuelta.toFixed(1)} ms ida y vuelta` : `volvieron ${recibidos} bytes y no coinciden`,
    );
  } catch (error) {
    registrar(`Eco binario de ${bytes.toLocaleString('es-MX')} bytes`, false, error.message);
  }
}

console.log(`\n  ...  Conexión inactiva durante ${segundosDeInactividad} s, a ver si el proxy la corta\n`);
const corte = await esperarInactivo(socket, segundosDeInactividad);

if (corte) {
  registrar(
    `Sobrevive ${segundosDeInactividad} s inactiva`,
    false,
    `el proxy cortó a los ${corte.segundos} s con código ${corte.codigo}`,
  );
} else {
  try {
    const carga = randomBytes(32);
    const { identico } = await ecoDe(socket, carga);
    registrar(`Sobrevive ${segundosDeInactividad} s inactiva y sigue respondiendo`, identico);
  } catch (error) {
    registrar(`Sobrevive ${segundosDeInactividad} s inactiva y sigue respondiendo`, false, error.message);
  }
}

socket.close();

const fallos = resultados.filter((r) => !r.correcto).length;
console.log(`\n${resultados.length - fallos} de ${resultados.length} comprobaciones correctas\n`);
process.exit(fallos === 0 ? 0 : 1);
