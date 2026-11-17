import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FORMATO_DE_TABLERO,
  type TableroEnJson,
  generarIdentidadDeSala,
  generarIdentificadorDeCommit,
  tableroEnJsonVacio,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { abrirAlmacenDeCommits } from './almacen-de-commits.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function directorioTemporal(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-commits-'));
  temporales.push(dir);
  return dir;
}

describe('almacén de commits', () => {
  it('guarda raíz, hijo, lista ordenado y lee snapshot (bytes + JSON)', () => {
    const dir = directorioTemporal();
    const archivo = path.join(dir, 'replica.sqlite');
    const almacen = abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;
    const yjsRaiz = Uint8Array.from([1, 2, 3, 4]);
    const tableroRaiz: TableroEnJson = {
      formato: FORMATO_DE_TABLERO,
      formas: [
        {
          tipo: 'pagina',
          id: 'page:inicio',
          nombre: 'Inicio',
          indice: 'a0',
          meta: {},
        },
      ],
    };

    const raiz = almacen.guardar({
      sala,
      padre: null,
      mensaje: 'primera',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 100,
      estadoYjs: yjsRaiz,
      tablero: tableroRaiz,
    });
    expect(raiz.ok).toBe(true);
    if (!raiz.ok) return;

    const yjsHijo = Uint8Array.from([9, 8, 7]);
    const hijo = almacen.guardar({
      sala,
      padre: raiz.commit.id,
      mensaje: 'segunda',
      autor: 'Ana',
      participantes: ['Marco', 'Ana'],
      creadoEn: 200,
      estadoYjs: yjsHijo,
      tablero: tableroEnJsonVacio(),
    });
    expect(hijo.ok).toBe(true);
    if (!hijo.ok) return;

    const historial = almacen.listarHistorial(sala);
    expect(historial.map((c) => c.mensaje)).toEqual(['primera', 'segunda']);
    expect(historial[1]?.padre).toBe(raiz.commit.id);

    const snapRaiz = almacen.leerSnapshot(raiz.commit.id);
    expect(snapRaiz).not.toBeNull();
    expect(Array.from(snapRaiz!.estadoYjs)).toEqual([1, 2, 3, 4]);
    expect(snapRaiz!.tablero).toEqual(tableroRaiz);

    const snapHijo = almacen.leerSnapshot(hijo.commit.id);
    expect(snapHijo).not.toBeNull();
    expect(Array.from(snapHijo!.estadoYjs)).toEqual([9, 8, 7]);
    expect(snapHijo!.tablero.formas).toEqual([]);

    almacen.cerrar();

    // Reabrir: el grafo sigue en disco.
    const otraVez = abrirAlmacenDeCommits(archivo);
    expect(otraVez.listarHistorial(sala).map((c) => c.mensaje)).toEqual(['primera', 'segunda']);
    otraVez.cerrar();
  });

  it('rechaza una segunda raíz (F-V4)', () => {
    const archivo = path.join(directorioTemporal(), 'replica.sqlite');
    const almacen = abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;

    expect(
      almacen.guardar({
        sala,
        padre: null,
        mensaje: 'uno',
        autor: 'Marco',
        participantes: [],
        creadoEn: 1,
        estadoYjs: new Uint8Array([1]),
        tablero: tableroEnJsonVacio(),
      }).ok,
    ).toBe(true);

    expect(
      almacen.guardar({
        sala,
        padre: null,
        mensaje: 'dos',
        autor: 'Marco',
        participantes: [],
        creadoEn: 2,
        estadoYjs: new Uint8Array([2]),
        tablero: tableroEnJsonVacio(),
      }),
    ).toEqual({ ok: false, causa: 'raiz-ya-existe' });

    almacen.cerrar();
  });

  it('rechaza un padre inexistente', () => {
    const archivo = path.join(directorioTemporal(), 'replica.sqlite');
    const almacen = abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;

    expect(
      almacen.guardar({
        sala,
        padre: generarIdentificadorDeCommit(),
        mensaje: 'huérfano',
        autor: 'Marco',
        participantes: [],
        creadoEn: 1,
        estadoYjs: new Uint8Array([1]),
        tablero: tableroEnJsonVacio(),
      }),
    ).toEqual({ ok: false, causa: 'padre-inexistente' });

    almacen.cerrar();
  });

  it('prohíbe abrir sala.sqlite como almacén (F-V6)', () => {
    const archivo = path.join(directorioTemporal(), 'sala.sqlite');
    expect(() => abrirAlmacenDeCommits(archivo)).toThrow(/sala\.sqlite/);
  });
});
