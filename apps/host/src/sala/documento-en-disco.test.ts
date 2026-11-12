/**
 * D1. El documento de la sala se guarda en SQLite y se vuelve a cargar
 * con el mismo nombre. La identidad que hace que el proceso real reuse
 * ese nombre es D2.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import {
  type IdentificadorDeSala,
  type TokenDeWebDelHost,
  generarIdentidadDeSala,
  generarIdentificadorDeConexion,
} from '@harukoia/domain';
import { crearRegistro, type Evento } from '@harukoia/registro';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';

import { abrirSalaEnVivo, type SalaEnVivo } from './sala.ts';

type Abierta = { sala: SalaEnVivo; sockets: WebSocketServer; servidor: Server; url: string };

const abiertos: Abierta[] = [];
let directorio = '';

afterEach(async () => {
  for (const abierto of abiertos.splice(0)) await soltar(abierto);
  if (directorio !== '') await rm(directorio, { recursive: true, force: true });
  directorio = '';
});

async function soltar(abierto: Abierta): Promise<void> {
  await abierto.sala.cerrar();
  abierto.sockets.close();
  await new Promise<void>((listo) => abierto.servidor.close(() => listo()));
}

async function salaEn(
  archivo: string,
  nombre: IdentificadorDeSala,
  tokenDeWebDelHost: TokenDeWebDelHost,
  eventos: Evento[] = [],
): Promise<Abierta> {
  const registro = crearRegistro({ proceso: 'host', destino: (evento) => eventos.push(evento) });
  const sala = await abrirSalaEnVivo({
    sala: nombre,
    archivoSqlite: archivo,
    tokenDeWebDelHost,
    acciones: { 'cambiar-invitacion': async () => ({ ok: true, avisos: [] }) },
    registro,
  });
  const servidor = createServer();
  const sockets = new WebSocketServer({ server: servidor });
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
  const abierta = { sala, sockets, servidor, url: `ws://127.0.0.1:${direccion.port}` };
  abiertos.push(abierta);
  return abierta;
}

function cliente(url: string, nombre: string): { documento: Y.Doc; cerrar: () => void } {
  const documento = new Y.Doc();
  const websocket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket });
  const proveedor = new HocuspocusProvider({ websocketProvider: websocket, name: nombre, document: documento });
  proveedor.attach();
  return {
    documento,
    cerrar() {
      proveedor.destroy();
      websocket.destroy();
      documento.destroy();
    },
  };
}

async function esperar(condicion: () => boolean): Promise<void> {
  const limite = Date.now() + 5_000;
  while (Date.now() < limite) {
    if (condicion()) return;
    await new Promise((listo) => setTimeout(listo, 20));
  }
  throw new Error('no llegó a tiempo');
}

describe('documento en disco', () => {
  it('al cerrar y volver a abrir el mismo nombre, el mapa está y los tokens no', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'documento-'));
    const archivo = path.join(directorio, 'sala.sqlite');
    const identidad = generarIdentidadDeSala();

    const primera = await salaEn(archivo, identidad.sala, identidad.tokenDeWebDelHost);
    expect(primera.sala.documentos()).toBe(1);

    const ana = cliente(primera.url, identidad.sala);
    const beto = cliente(primera.url, identidad.sala);
    ana.documento.getMap('tablero').set('trazo', 'trazo-visible');
    await esperar(() => beto.documento.getMap('tablero').get('trazo') === 'trazo-visible');
    ana.cerrar();
    beto.cerrar();
    await soltar(primera);
    abiertos.splice(abiertos.indexOf(primera), 1);

    const segunda = await salaEn(archivo, identidad.sala, identidad.tokenDeWebDelHost);
    const vuelta = cliente(segunda.url, identidad.sala);
    await esperar(() => vuelta.documento.getMap('tablero').get('trazo') === 'trazo-visible');
    vuelta.cerrar();

    const db = new Database(archivo, { readonly: true });
    const fila = db.prepare('SELECT data FROM documents WHERE name = ?').get(identidad.sala) as
      | { data: Buffer }
      | undefined;
    db.close();
    expect(fila).toBeDefined();
    const bytes = fila?.data.toString('utf8') ?? '';
    expect(bytes).not.toContain(identidad.tokenDeHost);
    expect(bytes).not.toContain(identidad.tokenDeInvitacion);
    expect(bytes).not.toContain(identidad.tokenDeWebDelHost);
  });

  it('un segundo abierto del mismo archivo falla y el primero sigue', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'documento-'));
    const archivo = path.join(directorio, 'sala.sqlite');
    const identidad = generarIdentidadDeSala();
    const eventos: Evento[] = [];

    const primera = await salaEn(archivo, identidad.sala, identidad.tokenDeWebDelHost);
    await expect(salaEn(archivo, identidad.sala, identidad.tokenDeWebDelHost, eventos)).rejects.toThrow(/database is locked/);
    expect(
      eventos.some((evento) => evento.nivel === 'error' && evento.mensaje === 'no se pudo abrir el documento de la sala'),
    ).toBe(true);
    expect(primera.sala.documentos()).toBe(1);
  });

  it('un archivo que no se puede abrir no cambia de sala: la causa queda en el log', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'documento-'));
    const eventos: Evento[] = [];
    const identidad = generarIdentidadDeSala();

    await expect(
      abrirSalaEnVivo({
        sala: identidad.sala,
        archivoSqlite: path.join(directorio, 'no-es-directorio', 'sala.sqlite'),
        tokenDeWebDelHost: identidad.tokenDeWebDelHost,
        acciones: { 'cambiar-invitacion': async () => ({ ok: true, avisos: [] }) },
        registro: crearRegistro({ proceso: 'host', destino: (evento) => eventos.push(evento) }),
      }),
    ).rejects.toThrow();

    expect(
      eventos.some((evento) => evento.nivel === 'error' && evento.mensaje === 'no se pudo abrir el documento de la sala'),
    ).toBe(true);
  });

  it('un nombre de documento distinto no crea otro documento', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'documento-'));
    const identidad = generarIdentidadDeSala();
    const abierta = await salaEn(path.join(directorio, 'sala.sqlite'), identidad.sala, identidad.tokenDeWebDelHost);
    const ajeno = cliente(abierta.url, 'otro-nombre');
    await new Promise((listo) => setTimeout(listo, 300));
    expect(abierta.sala.documentos()).toBe(1);
    ajeno.cerrar();
  });
});
