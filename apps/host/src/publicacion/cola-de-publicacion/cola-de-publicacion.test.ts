import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  generarIdentidadDeSala,
  generarIdentificadorDeCommit,
  tableroEnJsonVacio,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { abrirAlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { abrirColaDePublicacion } from './cola-de-publicacion.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function dirTemporal(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-cola-pub-'));
  temporales.push(dir);
  return dir;
}

describe('cola de publicación (P3)', () => {
  it('encolar → procesar → estado terminal publicado', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();

    const encolado = cola.encolar(commit, { ahora: 1000 });
    expect(encolado.ok).toBe(true);
    if (!encolado.ok) return;
    expect(encolado.trabajo.estado).toBe('pendiente');
    expect(encolado.trabajo.commit).toBe(commit);

    const procesado = await cola.procesarSiguiente(async () => ({ ok: true }), { ahora: 2000 });
    expect(procesado.ok).toBe(true);
    if (!procesado.ok) return;
    expect(procesado.trabajo?.estado).toBe('publicado');
    expect(cola.leer(encolado.trabajo.id)?.estado).toBe('publicado');
  });

  it('fallo del procesador deja fallido con causa', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();
    cola.encolar(commit);

    const procesado = await cola.procesarSiguiente(async () => ({
      ok: false,
      causa: 'remoto-no-configurado',
    }));
    expect(procesado.ok).toBe(false);
    if (procesado.ok) return;
    expect(procesado.trabajo.estado).toBe('fallido');
    expect(procesado.trabajo.causa).toBe('remoto-no-configurado');
    expect(procesado.causa).toBe('remoto-no-configurado');
  });

  it('rearranque recupera en-proceso como pendiente y lo termina', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();
    const encolado = cola.encolar(commit);
    expect(encolado.ok).toBe(true);
    if (!encolado.ok) return;

    // Simula crash a mitad: marca en-proceso en disco a mano.
    const crudo = JSON.parse(fs.readFileSync(archivo, 'utf8')) as {
      version: 1;
      trabajos: Array<Record<string, unknown>>;
    };
    crudo.trabajos[0] = {
      ...crudo.trabajos[0],
      estado: 'en-proceso',
      intentos: 1,
    };
    fs.writeFileSync(archivo, JSON.stringify(crudo));

    const cola2 = abrirColaDePublicacion(archivo, { ahora: 3000 });
    const recuperado = cola2.leer(encolado.trabajo.id);
    expect(recuperado?.estado).toBe('pendiente');
    expect(recuperado?.causa).toBe('proceso-interrumpido');

    const procesado = await cola2.procesarSiguiente(async () => ({ ok: true }));
    expect(procesado.ok).toBe(true);
    expect(cola2.leer(encolado.trabajo.id)?.estado).toBe('publicado');
  });

  it('fallo del job no borra el commit H4 del almacén', async () => {
    const dir = dirTemporal();
    const almacen = await abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const guardado = await almacen.guardar({
      sala,
      padre: null,
      mensaje: 'version-p3',
      autor: 'Hector',
      participantes: ['Hector'],
      creadoEn: 1000,
      estadoYjs: new Uint8Array([1, 2, 3]),
      tablero: tableroEnJsonVacio(),
    });
    expect(guardado.ok).toBe(true);
    if (!guardado.ok) return;
    const commitId = guardado.commit.id;

    const cola = abrirColaDePublicacion(path.join(dir, 'cola.json'));
    cola.encolar(commitId);
    await cola.procesarSiguiente(async () => ({ ok: false, causa: 'inyectado' }));

    const historial = await almacen.listarHistorial(sala);
    expect(historial).toHaveLength(1);
    expect(historial[0]?.id).toBe(commitId);
    expect(historial[0]?.mensaje).toBe('version-p3');
    const snap = await almacen.leerSnapshot(commitId);
    expect(snap).not.toBeNull();

    await almacen.cerrar();
  });

  it('idempotencia: no encola dos activos del mismo commit', () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();

    const primero = cola.encolar(commit);
    expect(primero.ok).toBe(true);

    const segundo = cola.encolar(commit);
    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.causa).toBe('ya-encolado');
  });

  it('idempotencia: no re-encola un commit ya publicado', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();
    cola.encolar(commit);
    await cola.procesarSiguiente(async () => ({ ok: true }));

    const otraVez = cola.encolar(commit);
    expect(otraVez.ok).toBe(false);
    if (otraVez.ok) return;
    expect(otraVez.causa).toBe('ya-publicado');
  });

  it('reintentar desde fallido vuelve a pendiente', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();
    const encolado = cola.encolar(commit);
    expect(encolado.ok).toBe(true);
    if (!encolado.ok) return;

    await cola.procesarSiguiente(async () => ({ ok: false, causa: 'fallo-1' }));
    const reintento = cola.reintentar(encolado.trabajo.id, { ahora: 4000 });
    expect(reintento.ok).toBe(true);
    if (!reintento.ok) return;
    expect(reintento.trabajo.estado).toBe('pendiente');

    const procesado = await cola.procesarSiguiente(async () => ({ ok: true }));
    expect(procesado.ok).toBe(true);
    expect(cola.leer(encolado.trabajo.id)?.estado).toBe('publicado');
    expect(cola.leer(encolado.trabajo.id)?.intentos).toBe(2);
  });

  it('tras fallido, encolar de nuevo crea otro trabajo del mismo commit', async () => {
    const archivo = path.join(dirTemporal(), 'cola.json');
    const cola = abrirColaDePublicacion(archivo);
    const commit = generarIdentificadorDeCommit();
    cola.encolar(commit);
    await cola.procesarSiguiente(async () => ({ ok: false, causa: 'fallo' }));

    const otraVez = cola.encolar(commit);
    expect(otraVez.ok).toBe(true);
    if (!otraVez.ok) return;
    expect(otraVez.trabajo.estado).toBe('pendiente');
    expect(cola.listar()).toHaveLength(2);
  });
});
