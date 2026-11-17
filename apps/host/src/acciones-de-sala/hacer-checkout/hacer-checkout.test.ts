import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generarIdentidadDeSala, generarIdentificadorDeCommit, tableroEnJsonVacio } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { abrirAlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { MAPA_DEL_TABLERO } from '../../versionado/restaurar-estado-de-trabajo/restaurar-estado-de-trabajo.ts';
import { crearTipDeTrabajo } from '../../versionado/tip-de-trabajo/tip-de-trabajo.ts';
import { hacerCheckout } from './hacer-checkout.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales) fs.rmSync(dir, { recursive: true, force: true });
  temporales.length = 0;
});

describe('hacer-checkout', () => {
  it('A → B → checkout A → tip = A y tablero vuelve a A', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-checkout-'));
    temporales.push(dir);
    const almacen = abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const tip = crearTipDeTrabajo();
    const documento = new Y.Doc();

    documento.getMap<string>(MAPA_DEL_TABLERO).set('shape:a', JSON.stringify({ id: 'shape:a' }));
    const snapA = Y.encodeStateAsUpdate(documento);
    const a = almacen.guardar({
      sala,
      padre: null,
      mensaje: 'A',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 1,
      estadoYjs: snapA,
      tablero: tableroEnJsonVacio(),
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    tip.fijar(a.commit.id);

    documento.getMap<string>(MAPA_DEL_TABLERO).set('shape:b', JSON.stringify({ id: 'shape:b' }));
    const snapB = Y.encodeStateAsUpdate(documento);
    const b = almacen.guardar({
      sala,
      padre: a.commit.id,
      mensaje: 'B',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 2,
      estadoYjs: snapB,
      tablero: tableroEnJsonVacio(),
    });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    tip.fijar(b.commit.id);

    const manejador = hacerCheckout({
      sala,
      almacen,
      documento: () => documento,
      tip,
    });

    return manejador(
      { tipo: 'pedir-accion', accion: 'hacer-checkout', id: a.commit.id },
      { autor: 'Marco' },
    ).then((resultado) => {
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.avisos[0]?.mensaje).toEqual({ tipo: 'checkout-hecho', id: a.commit.id });
      expect(tip.leer()).toBe(a.commit.id);
      expect([...documento.getMap<string>(MAPA_DEL_TABLERO).keys()].sort()).toEqual(['shape:a']);

      const c = almacen.guardar({
        sala,
        padre: tip.leer(),
        mensaje: 'C',
        autor: 'Marco',
        participantes: ['Marco'],
        creadoEn: 3,
        estadoYjs: Y.encodeStateAsUpdate(documento),
        tablero: tableroEnJsonVacio(),
      });
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      expect(c.commit.padre).toBe(a.commit.id);

      almacen.cerrar();
    });
  });

  it('rechaza un commit que no existe (F-V3)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-checkout-'));
    temporales.push(dir);
    const almacen = abrirAlmacenDeCommits(path.join(dir, 'replica.sqlite'));
    const sala = generarIdentidadDeSala().sala;
    const tip = crearTipDeTrabajo();
    const manejador = hacerCheckout({
      sala,
      almacen,
      documento: () => new Y.Doc(),
      tip,
    });

    const resultado = await manejador(
      { tipo: 'pedir-accion', accion: 'hacer-checkout', id: generarIdentificadorDeCommit() },
      { autor: 'Marco' },
    );
    expect(resultado).toEqual({ ok: false, causa: 'commit-inexistente' });
    almacen.cerrar();
  });
});
