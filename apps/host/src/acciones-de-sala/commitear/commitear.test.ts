import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generarIdentidadDeSala } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { abrirAlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { crearTipDeTrabajo } from '../../versionado/tip-de-trabajo/tip-de-trabajo.ts';
import { MAPA_DEL_TABLERO, commitear } from './commitear.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('commitear', () => {
  it('guarda raíz con snapshot y avisa commit-guardado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-commitear-'));
    temporales.push(dir);
    const almacen = await abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const documento = new Y.Doc();
    documento.getMap(MAPA_DEL_TABLERO);

    const tip = crearTipDeTrabajo();
    let compactaciones = 0;
    const manejador = commitear({
      sala,
      almacen,
      documento: () => documento,
      tip,
      nombresPresentes: () => ['Marco', 'Ana'],
      compactarDocumentoVivo: async () => {
        compactaciones += 1;
      },
    });

    const resultado = await manejador(
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'primera' },
      { autor: 'Marco', avisar: () => {} },
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(compactaciones).toBe(1);
    expect(resultado.avisos[0]?.destino).toBe('todos');
    expect(resultado.avisos[0]?.mensaje).toMatchObject({
      tipo: 'commit-guardado',
      mensaje: 'primera',
      autor: 'Marco',
    });
    const historial = await almacen.listarHistorial(sala);
    expect(historial).toHaveLength(1);
    expect(historial[0]?.mensaje).toBe('primera');
    expect(historial[0]?.participantes).toEqual(['Marco', 'Ana']);
    expect(historial[0]?.autor).toBe('Marco');

    const snap = await almacen.leerSnapshot(historial[0]!.id);
    expect(snap).not.toBeNull();
    expect(snap!.estadoYjs.byteLength).toBeGreaterThan(0);

    await almacen.cerrar();
  });

  it('el segundo commit cuelga del primero', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-commitear-'));
    temporales.push(dir);
    const almacen = await abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const documento = new Y.Doc();
    const tip = crearTipDeTrabajo();
    const manejador = commitear({
      sala,
      almacen,
      documento: () => documento,
      tip,
      nombresPresentes: () => ['Marco'],
      compactarDocumentoVivo: async () => {},
    });

    const primero = await manejador(
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'uno' },
      { autor: 'Marco', avisar: () => {} },
    );
    expect(primero.ok).toBe(true);
    const segundo = await manejador(
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'dos' },
      { autor: 'Marco', avisar: () => {} },
    );
    expect(segundo.ok).toBe(true);
    if (!segundo.ok || !primero.ok) return;
    const historial = await almacen.listarHistorial(sala);
    const uno = historial.find((c) => c.mensaje === 'uno');
    const dos = historial.find((c) => c.mensaje === 'dos');
    expect(uno).toBeDefined();
    expect(dos).toBeDefined();
    expect(dos?.padre).toBe(uno?.id);
    expect(tip.leer()).toBe(dos?.id);

    await almacen.cerrar();
  });
});
