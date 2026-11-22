/**
 * V8 — resistencia corta: commit → compactar → rearrancar host → tablero + historial.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import {
  FORMATO_DE_TABLERO,
  generarIdentidadDeSala,
  generarIdentificadorDeConexion,
  type IdentificadorDeSala,
  type TokenDeWebDelHost,
} from '@harukoia/domain';
import { crearRegistro } from '@harukoia/registro';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';

import { abrirSalaEnVivo, type SalaEnVivo } from '../../sala/sala.ts';
import { abrirAlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { crearTipDeTrabajo } from '../../versionado/tip-de-trabajo/tip-de-trabajo.ts';
import { MAPA_DEL_TABLERO, commitear } from './commitear.ts';

type Abierta = {
  sala: SalaEnVivo;
  sockets: WebSocketServer;
  servidor: Server;
  url: string;
  tip: ReturnType<typeof crearTipDeTrabajo>;
  almacen: Awaited<ReturnType<typeof abrirAlmacenDeCommits>>;
};

const abiertos: Abierta[] = [];
let directorio = '';

afterEach(async () => {
  for (const abierto of abiertos.splice(0)) await soltar(abierto);
  if (directorio !== '') await rm(directorio, { recursive: true, force: true });
  directorio = '';
});

async function soltar(abierto: Abierta): Promise<void> {
  await abierto.almacen.cerrar().catch(() => {});
  await abierto.sala.cerrar();
  abierto.sockets.close();
  await new Promise<void>((listo) => abierto.servidor.close(() => listo()));
}

/** Registro mínimo aceptado por el traductor de H4 (misma forma que la suite del dominio). */
const FORMA_V8 = {
  id: 'shape:v8',
  typeName: 'shape' as const,
  type: 'geo',
  x: 10,
  y: 20,
  rotation: 0,
  index: 'a1',
  parentId: 'page:inicio',
  isLocked: false,
  opacity: 1,
  props: { geo: 'rectangle', w: 40, h: 30, color: 'black' },
  meta: {},
};

async function salaConCommitear(
  archivoSala: string,
  archivoReplica: string,
  nombre: IdentificadorDeSala,
  tokenDeWebDelHost: TokenDeWebDelHost,
): Promise<Abierta> {
  const registro = crearRegistro({ proceso: 'host', destino: () => {} });
  const almacen = await abrirAlmacenDeCommits(archivoReplica);
  const tip = crearTipDeTrabajo((await almacen.listarHistorial(nombre)).at(-1)?.id ?? null);

  let salaRef: SalaEnVivo | undefined;
  const sala = await abrirSalaEnVivo({
    sala: nombre,
    archivoSqlite: archivoSala,
    tokenDeWebDelHost,
    acciones: {
      'cambiar-invitacion': async () => ({ ok: true, avisos: [] }),
      commitear: async () => ({ ok: true, avisos: [] }),
      'hacer-checkout': async () => ({ ok: true, avisos: [] }),
    },
    registro,
  });
  salaRef = sala;

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
  const abierta: Abierta = {
    sala,
    sockets,
    servidor,
    url: `ws://127.0.0.1:${direccion.port}`,
    tip,
    almacen,
  };
  abiertos.push(abierta);
  void salaRef;
  return abierta;
}

function cliente(url: string, nombre: string): { documento: Y.Doc; cerrar: () => void } {
  const documento = new Y.Doc();
  const websocket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket });
  const proveedor = new HocuspocusProvider({
    websocketProvider: websocket,
    name: nombre,
    document: documento,
  });
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

describe('compactación tras commit (V8)', () => {
  it('commit → compactar → rearrancar: tablero e historial siguen', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'compactacion-v8-'));
    const archivoSala = path.join(directorio, 'sala.sqlite');
    const archivoReplica = path.join(directorio, 'replica.sqlite');
    const identidad = generarIdentidadDeSala();

    const primera = await salaConCommitear(
      archivoSala,
      archivoReplica,
      identidad.sala,
      identidad.tokenDeWebDelHost,
    );

    const dibujo = cliente(primera.url, identidad.sala);
    dibujo.documento.getMap(MAPA_DEL_TABLERO).set(FORMA_V8.id, JSON.stringify(FORMA_V8));
    await esperar(() => primera.sala.documento().getMap(MAPA_DEL_TABLERO).has(FORMA_V8.id));

    const manejador = commitear({
      sala: identidad.sala,
      almacen: primera.almacen,
      documento: () => primera.sala.documento(),
      tip: primera.tip,
      nombresPresentes: () => ['Marco'],
      compactarDocumentoVivo: () => primera.sala.persistirDocumentoAhora(),
    });

    const resultado = await manejador(
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'v8 compacta' },
      { autor: 'Marco' },
    );
    expect(resultado.ok).toBe(true);

    const historialAntes = await primera.almacen.listarHistorial(identidad.sala);
    expect(historialAntes).toHaveLength(1);
    expect(historialAntes[0]?.mensaje).toBe('v8 compacta');

    const dbAntes = new Database(archivoSala, { readonly: true });
    const filaAntes = dbAntes.prepare('SELECT data FROM documents WHERE name = ?').get(identidad.sala) as
      | { data: Buffer }
      | undefined;
    dbAntes.close();
    expect(filaAntes?.data.byteLength).toBeGreaterThan(0);

    dibujo.cerrar();
    await soltar(primera);
    abiertos.splice(abiertos.indexOf(primera), 1);

    const segunda = await salaConCommitear(
      archivoSala,
      archivoReplica,
      identidad.sala,
      identidad.tokenDeWebDelHost,
    );
    const vuelta = cliente(segunda.url, identidad.sala);
    await esperar(() => vuelta.documento.getMap(MAPA_DEL_TABLERO).has(FORMA_V8.id));

    const raw = vuelta.documento.getMap(MAPA_DEL_TABLERO).get(FORMA_V8.id);
    expect(typeof raw).toBe('string');
    const leido = JSON.parse(raw as string) as { id: string; typeName: string };
    expect(leido.id).toBe(FORMA_V8.id);
    expect(leido.typeName).toBe('shape');

    const historialDespues = await segunda.almacen.listarHistorial(identidad.sala);
    expect(historialDespues).toHaveLength(1);
    expect(historialDespues[0]?.mensaje).toBe('v8 compacta');
    expect(historialDespues[0]?.id).toBe(historialAntes[0]?.id);

    const snap = await segunda.almacen.leerSnapshot(historialDespues[0]!.id);
    expect(snap).not.toBeNull();
    expect(snap!.tablero.formato).toBe(FORMATO_DE_TABLERO);

    vuelta.cerrar();
  });

  it('si la compactación falla, el commit igual queda', async () => {
    directorio = await mkdtemp(path.join(tmpdir(), 'compactacion-v8-fail-'));
    const almacen = await abrirAlmacenDeCommits(path.join(directorio, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const documento = new Y.Doc();
    documento.getMap(MAPA_DEL_TABLERO);
    const tip = crearTipDeTrabajo();

    const manejador = commitear({
      sala,
      almacen,
      documento: () => documento,
      tip,
      nombresPresentes: () => ['Marco'],
      compactarDocumentoVivo: async () => {
        throw new Error('disco lleno simulado');
      },
    });

    const resultado = await manejador(
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'aunque falle compactar' },
      { autor: 'Marco' },
    );

    expect(resultado.ok).toBe(true);
    const historial = await almacen.listarHistorial(sala);
    expect(historial).toHaveLength(1);
    expect(historial[0]?.mensaje).toBe('aunque falle compactar');
    await almacen.cerrar();
  });
});
