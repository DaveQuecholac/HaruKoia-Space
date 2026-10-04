import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { crearRegistro, formatearLinea } from '@harukoia/registro';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { montarEcoDeDiagnostico, RUTA_DE_ECO } from './eco.ts';

let servidor: Server;
let base: string;

/** El registro va a un destino en memoria: las pruebas no ensucian la salida. */
const lineas: string[] = [];

beforeAll(async () => {
  servidor = createServer();
  montarEcoDeDiagnostico(
    servidor,
    crearRegistro({
      proceso: 'orquestador',
      destino: (evento) => lineas.push(formatearLinea(evento)),
    }),
  );

  // Puerto cero: lo asigna el sistema, así dos corridas no chocan.
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));

  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string') {
    throw new Error('el servidor de prueba no expuso un puerto');
  }
  base = `ws://127.0.0.1:${direccion.port}`;
});

afterAll(async () => {
  await new Promise<void>((listo) => servidor.close(() => listo()));
});

function conectar(ruta: string): Promise<WebSocket> {
  const socket = new WebSocket(`${base}${ruta}`);
  return new Promise((resolver, rechazar) => {
    socket.once('open', () => resolver(socket));
    socket.once('error', rechazar);
  });
}

function ecoDe(socket: WebSocket, carga: Buffer): Promise<Buffer> {
  return new Promise((resolver) => {
    socket.once('message', (respuesta) => {
      resolver(Buffer.isBuffer(respuesta) ? respuesta : Buffer.from(respuesta as ArrayBuffer));
    });
    socket.send(carga, { binary: true });
  });
}

describe('eco de diagnóstico', () => {
  it(
    'devuelve un mensaje binario idéntico',
    async () => {
      const socket = await conectar(RUTA_DE_ECO);
      const enviado = randomBytes(1024);

      const recibido = await ecoDe(socket, enviado);

      expect(Buffer.compare(recibido, enviado)).toBe(0);
      socket.close();
    },
    10_000,
  );

  it(
    'no altera un mensaje grande',
    async () => {
      const socket = await conectar(RUTA_DE_ECO);
      const enviado = randomBytes(256 * 1024);

      const recibido = await ecoDe(socket, enviado);

      expect(recibido.length).toBe(enviado.length);
      expect(Buffer.compare(recibido, enviado)).toBe(0);
      socket.close();
    },
    10_000,
  );

  it(
    'atiende a varios clientes sin cruzar sus mensajes',
    async () => {
      const clientes = await Promise.all([
        conectar(RUTA_DE_ECO),
        conectar(RUTA_DE_ECO),
        conectar(RUTA_DE_ECO),
      ]);
      const cargas = clientes.map(() => randomBytes(512));

      const respuestas = await Promise.all(
        clientes.map((socket, i) => ecoDe(socket, cargas[i]!)),
      );

      for (const [i, respuesta] of respuestas.entries()) {
        expect(Buffer.compare(respuesta, cargas[i]!)).toBe(0);
      }
      for (const socket of clientes) socket.close();
    },
    10_000,
  );

  it(
    'rechaza una ruta que no es la del eco',
    async () => {
      await expect(conectar('/ruta-inexistente')).rejects.toThrow();
    },
    10_000,
  );

  it(
    'deja rastro de cada conexión en el registro, con proceso y conexión',
    async () => {
      const antes = lineas.length;
      const socket = await conectar(RUTA_DE_ECO);
      await ecoDe(socket, randomBytes(8));

      const nuevas = lineas.slice(antes);

      expect(nuevas.some((linea) => linea.includes('orquestador'))).toBe(true);
      expect(nuevas.some((linea) => /conexion=\d+ /.test(linea))).toBe(true);
      expect(nuevas.every((linea) => !linea.includes('\n'))).toBe(true);
      socket.close();
    },
    10_000,
  );
});
