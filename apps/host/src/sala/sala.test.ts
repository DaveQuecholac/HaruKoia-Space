/**
 * Cien ciclos de entrar y salir de la sala en vivo, dentro del proceso.
 *
 * El túnel no participa: un servidor local entrega cada socket al manejador
 * de la sala, igual que lo hace la conexión de datos. Lo que se mide es que
 * Hocuspocus suelte cada conexión y siga con un solo documento.
 */

import { createServer, type Server } from 'node:http';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { generarIdentidadDeSala, generarIdentificadorDeConexion } from '@harukoia/domain';
import { crearRegistro } from '@harukoia/registro';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';

import { abrirSalaEnVivo, type SalaEnVivo } from './sala.ts';

const CICLOS = 100;
const MARGEN_DE_MEMORIA = 16 * 1024 * 1024;

let servidor: Server;
let sockets: WebSocketServer;
let sala: SalaEnVivo;
let url: string;
let nombreDeLaSala: string;

beforeEach(async () => {
  const registro = crearRegistro({ proceso: 'host', destino: () => {} });
  const identidad = generarIdentidadDeSala();
  nombreDeLaSala = identidad.sala;
  sala = await abrirSalaEnVivo({
    sala: identidad.sala,
    tokenDeWebDelHost: identidad.tokenDeWebDelHost,
    acciones: { 'cambiar-invitacion': async () => ({ ok: true, avisos: [] }) },
    registro,
  });

  servidor = createServer();
  sockets = new WebSocketServer({ server: servidor });
  sockets.on('connection', (socket) => {
    sala.manejador({
      conexion: generarIdentificadorDeConexion(),
      canal: 'sesion',
      socket,
      registro,
    });
  });

  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string') throw new Error('sin puerto');
  url = `ws://127.0.0.1:${direccion.port}`;
});

afterEach(async () => {
  await sala.cerrar();
  sockets.close();
  await new Promise<void>((listo) => servidor.close(() => listo()));
});

/** Un invitado entra, escribe algo, se sincroniza y se va. */
async function ciclo(i: number): Promise<void> {
  const documento = new Y.Doc();
  const websocket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket });
  const proveedor = new HocuspocusProvider({ websocketProvider: websocket, name: nombreDeLaSala, document: documento });
  proveedor.attach();

  await new Promise<void>((listo) => proveedor.on('synced', () => listo()));
  documento.getMap('pizarra').set(`ciclo-${i % 5}`, i);

  proveedor.destroy();
  websocket.destroy();
  documento.destroy();
}

async function esperarSinConexiones(): Promise<void> {
  const limite = Date.now() + 5_000;
  while (Date.now() < limite) {
    if (sala.conexiones() === 0 && sockets.clients.size === 0) return;
    await new Promise((listo) => setTimeout(listo, 20));
  }
}

function recolectorDeBasura(): () => void {
  setFlagsFromString('--expose-gc');
  const gc = runInNewContext('gc') as () => void;
  return () => {
    gc();
    gc();
  };
}

describe('cien ciclos sin fugas', () => {
  it('conexiones a cero, un solo documento y memoria dentro del margen', async () => {
    const recolectar = recolectorDeBasura();

    for (let i = 0; i < 10; i++) await ciclo(i);
    await esperarSinConexiones();
    recolectar();
    const antes = process.memoryUsage().heapUsed;

    for (let i = 0; i < CICLOS; i++) await ciclo(i);
    await esperarSinConexiones();
    recolectar();
    const despues = process.memoryUsage().heapUsed;

    expect(sala.conexiones()).toBe(0);
    expect(sockets.clients.size).toBe(0);
    expect(sala.documentos()).toBe(1);
    expect(sala.participantes()).toEqual([]);
    expect(despues - antes).toBeLessThan(MARGEN_DE_MEMORIA);
  }, 60_000);
});
