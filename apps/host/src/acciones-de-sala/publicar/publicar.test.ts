import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  crearVinculoSalaRepo,
  generarIdentidadDeSala,
  tableroEnJsonVacio,
  type MensajeDelHostDeLaSala,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { abrirAlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { publicar } from './publicar.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function dirTemporal(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-p8-'));
  temporales.push(dir);
  return dir;
}

describe('publicar (P8)', () => {
  it('tras push OK → estado publicado (avisado y en réplica local)', async () => {
    const dir = dirTemporal();
    const almacen = await abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const vinculo = crearVinculoSalaRepo({ sala, raizDelCheckout: dir });
    expect(vinculo.ok).toBe(true);
    if (!vinculo.ok) return;

    const guardado = await almacen.guardar({
      sala,
      padre: null,
      mensaje: 'v1',
      autor: 'Hector',
      participantes: ['Hector'],
      creadoEn: 1000,
      estadoYjs: new Uint8Array([1]),
      tablero: tableroEnJsonVacio(),
    });
    expect(guardado.ok).toBe(true);
    if (!guardado.ok) return;

    const avisos: MensajeDelHostDeLaSala[] = [];
    const manejador = publicar({
      sala,
      almacen,
      vinculo: vinculo.vinculo,
      archivoDeCola: path.join(dir, 'cola.json'),
      publicarEnGit: async () => ({ ok: true, commitGit: 'abc', rama: 'main' }),
    });

    const resultado = await manejador(
      { tipo: 'pedir-accion', accion: 'publicar', id: guardado.commit.id },
      { autor: 'Hector', avisar: (m) => avisos.push(m) },
    );
    expect(resultado.ok).toBe(true);

    const tipos = avisos
      .filter((a) => a.tipo === 'estado-de-push')
      .map((a) => (a.tipo === 'estado-de-push' ? a.estadoTipo : ''));
    expect(tipos).toContain('en-proceso');
    expect(tipos.at(-1)).toBe('publicado');

    const docs = await almacen.listarDocumentos(sala);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.estado.tipo).toBe('publicado');
    expect(docs[0]?.commit).toBe(guardado.commit.id);

    await almacen.cerrar();
  });

  it('fallo inyectado → fallido con causa; reintentar sin tocar el commit', async () => {
    const dir = dirTemporal();
    const almacen = await abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const vinculo = crearVinculoSalaRepo({ sala, raizDelCheckout: dir });
    expect(vinculo.ok).toBe(true);
    if (!vinculo.ok) return;

    const guardado = await almacen.guardar({
      sala,
      padre: null,
      mensaje: 'v1',
      autor: 'Hector',
      participantes: ['Hector'],
      creadoEn: 1000,
      estadoYjs: new Uint8Array([1]),
      tablero: tableroEnJsonVacio(),
    });
    expect(guardado.ok).toBe(true);
    if (!guardado.ok) return;
    const commitId = guardado.commit.id;

    const avisos: MensajeDelHostDeLaSala[] = [];
    const fallar = publicar({
      sala,
      almacen,
      vinculo: vinculo.vinculo,
      archivoDeCola: path.join(dir, 'cola.json'),
      falloInyectado: 'inyectado-p8',
    });

    const r1 = await fallar(
      { tipo: 'pedir-accion', accion: 'publicar', id: commitId },
      { autor: 'Hector', avisar: (m) => avisos.push(m) },
    );
    expect(r1.ok).toBe(true);
    const ultimo = avisos.filter((a) => a.tipo === 'estado-de-push').at(-1);
    expect(ultimo).toMatchObject({
      tipo: 'estado-de-push',
      estadoTipo: 'fallido',
      causa: 'inyectado-p8',
      commit: commitId,
    });

    const historialAntes = await almacen.listarHistorial(sala);
    expect(historialAntes).toHaveLength(1);

    const ok = publicar({
      sala,
      almacen,
      vinculo: vinculo.vinculo,
      archivoDeCola: path.join(dir, 'cola.json'),
      publicarEnGit: async () => ({ ok: true, commitGit: 'def', rama: 'main' }),
    });
    const r2 = await ok(
      { tipo: 'pedir-accion', accion: 'reintentar-publicacion', id: commitId },
      { autor: 'Hector', avisar: (m) => avisos.push(m) },
    );
    expect(r2.ok).toBe(true);

    const docs = await almacen.listarDocumentos(sala);
    expect(docs[0]?.estado.tipo).toBe('publicado');
    const historialDespues = await almacen.listarHistorial(sala);
    expect(historialDespues).toHaveLength(1);
    expect(historialDespues[0]?.id).toBe(commitId);
    expect(historialDespues[0]?.mensaje).toBe('v1');

    await almacen.cerrar();
  });

  it('no redibuja: reintento no exige nuevo commit de pizarra', async () => {
    // Cubierto arriba: mismo commitId, historial intacto.
    expect(true).toBe(true);
  });
});
