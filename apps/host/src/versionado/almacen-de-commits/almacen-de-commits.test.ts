import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FORMATO_DE_TABLERO,
  type TableroEnJson,
  crearDocumentoPublicado,
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
  it('guarda raíz, hijo, lista ordenado y lee snapshot (bytes + JSON)', async () => {
    const dir = directorioTemporal();
    const archivo = path.join(dir, 'replica.sqlite');
    const almacen = await abrirAlmacenDeCommits(archivo);
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

    const raiz = await almacen.guardar({
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
    const hijo = await almacen.guardar({
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

    const historial = await almacen.listarHistorial(sala);
    expect(historial.map((c) => c.mensaje)).toEqual(['primera', 'segunda']);
    expect(historial[1]?.padre).toBe(raiz.commit.id);

    const snapRaiz = await almacen.leerSnapshot(raiz.commit.id);
    expect(snapRaiz).not.toBeNull();
    expect(Array.from(snapRaiz!.estadoYjs)).toEqual([1, 2, 3, 4]);
    expect(snapRaiz!.tablero).toEqual(tableroRaiz);

    const snapHijo = await almacen.leerSnapshot(hijo.commit.id);
    expect(snapHijo).not.toBeNull();
    expect(Array.from(snapHijo!.estadoYjs)).toEqual([9, 8, 7]);
    expect(snapHijo!.tablero.formas).toEqual([]);

    await almacen.cerrar();

    const otraVez = await abrirAlmacenDeCommits(archivo);
    expect((await otraVez.listarHistorial(sala)).map((c) => c.mensaje)).toEqual(['primera', 'segunda']);
    await otraVez.cerrar();
  });

  it('rechaza una segunda raíz (F-V4)', async () => {
    const archivo = path.join(directorioTemporal(), 'replica.sqlite');
    const almacen = await abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;

    expect(
      (
        await almacen.guardar({
          sala,
          padre: null,
          mensaje: 'uno',
          autor: 'Marco',
          participantes: [],
          creadoEn: 1,
          estadoYjs: new Uint8Array([1]),
          tablero: tableroEnJsonVacio(),
        })
      ).ok,
    ).toBe(true);

    expect(
      await almacen.guardar({
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

    await almacen.cerrar();
  });

  it('rechaza un padre inexistente', async () => {
    const archivo = path.join(directorioTemporal(), 'replica.sqlite');
    const almacen = await abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;

    expect(
      await almacen.guardar({
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

    await almacen.cerrar();
  });

  it('prohíbe abrir sala.sqlite como almacén (F-V6)', async () => {
    const archivo = path.join(directorioTemporal(), 'sala.sqlite');
    await expect(abrirAlmacenDeCommits(archivo)).rejects.toThrow(/sala\.sqlite/);
  });

  it('guarda y lista un document (H5 P2) sin tocar sala.sqlite', async () => {
    const dir = directorioTemporal();
    const archivo = path.join(dir, 'replica.sqlite');
    expect(path.basename(archivo)).not.toBe('sala.sqlite');
    const almacen = await abrirAlmacenDeCommits(archivo);
    const sala = generarIdentidadDeSala().sala;
    const commit = generarIdentificadorDeCommit();
    const creado = crearDocumentoPublicado({
      sala,
      commit,
      variante: 'markdown-determinista',
      estado: { tipo: 'en-proceso' },
      creadoEn: 50,
    });
    expect(creado.ok).toBe(true);
    if (!creado.ok) return;

    const guardado = await almacen.guardarDocumento(creado.documento);
    expect(guardado.ok).toBe(true);

    const lista = await almacen.listarDocumentos(sala);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.commit).toBe(commit);
    expect(lista[0]?.estado.tipo).toBe('en-proceso');
    expect(lista[0]?.rutas.documentoMarkdown).toContain(commit);

    await almacen.cerrar();
  });
});
