import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  generarIdentificadorDeCommit,
  rutasDePublicacionDelCommit,
  tableroEnJsonVacio,
  type VarianteDePublicacion,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { abrirColaDePublicacion } from '../cola-de-publicacion/cola-de-publicacion.ts';
import { crearArtefactoDePublicacion } from './artefacto-de-publicacion.ts';
import {
  crearProcesadorDesdeRegistro,
  type CargadorDeEntrada,
} from './orquestar-publicacion.ts';
import { crearRegistroDeVariantes } from './registro-de-variantes.ts';
import type { EntradaDePublicacion, VarianteDeFormato } from './variante-de-formato.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function entradaFixture(commitId = generarIdentificadorDeCommit()): EntradaDePublicacion {
  return {
    commit: {
      id: commitId,
      mensaje: 'fixture',
      autor: 'Hector',
      participantes: ['Hector'],
      creadoEn: 1_700_000_000_000,
    },
    tablero: tableroEnJsonVacio(),
  };
}

function cargadorFijo(entrada: EntradaDePublicacion): CargadorDeEntrada {
  return async () => ({ ok: true, entrada });
}

function varianteMockQueEmite(
  id: string,
  texto: string,
): VarianteDeFormato {
  return {
    id,
    async producir({ entrada }) {
      const ruta = rutasDePublicacionDelCommit(entrada.commit.id).documentoMarkdown;
      const artefacto = crearArtefactoDePublicacion(ruta, new TextEncoder().encode(texto));
      if (!artefacto.ok) return { ok: false, causa: artefacto.causa };
      return { ok: true, artefactos: [artefacto.artefacto] };
    },
  };
}

describe('orquestar publicación (P4)', () => {
  it('variante mock registrada → la cola la invoca y termina publicado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-orq-'));
    temporales.push(dir);

    const commit = generarIdentificadorDeCommit();
    const idProducto: VarianteDePublicacion = 'markdown-determinista';
    let invocaciones = 0;
    const mock: VarianteDeFormato = {
      id: idProducto,
      async producir(ctx) {
        invocaciones += 1;
        expect(ctx.trabajo.commit).toBe(commit);
        const ruta = rutasDePublicacionDelCommit(commit).documentoMarkdown;
        const artefacto = crearArtefactoDePublicacion(
          ruta,
          new TextEncoder().encode('desde-mock'),
        );
        if (!artefacto.ok) return { ok: false, causa: artefacto.causa };
        return { ok: true, artefactos: [artefacto.artefacto] };
      },
    };

    const registro = crearRegistroDeVariantes([mock]);
    const procesador = crearProcesadorDesdeRegistro(
      registro,
      cargadorFijo(entradaFixture(commit)),
    );

    const cola = abrirColaDePublicacion(path.join(dir, 'cola.json'));
    const encolado = cola.encolar(commit, { variante: idProducto });
    expect(encolado.ok).toBe(true);

    const resultado = await cola.procesarSiguiente(procesador);
    expect(resultado.ok).toBe(true);
    expect(invocaciones).toBe(1);
    expect(cola.listar()[0]?.estado).toBe('publicado');
  });

  it('variante no registrada → fallido con causa explícita', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-orq-'));
    temporales.push(dir);
    const commit = generarIdentificadorDeCommit();
    const procesador = crearProcesadorDesdeRegistro(
      crearRegistroDeVariantes(),
      cargadorFijo(entradaFixture(commit)),
    );
    const cola = abrirColaDePublicacion(path.join(dir, 'cola.json'));
    cola.encolar(commit);
    const resultado = await cola.procesarSiguiente(procesador);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.causa).toMatch(/^variante-no-registrada:/);
  });

  it('segunda variante mock se resuelve por id sin tocar git ni CLI', async () => {
    const a = varianteMockQueEmite('mock-a', 'A');
    const b = varianteMockQueEmite('mock-b', 'B');
    const registro = crearRegistroDeVariantes([a, b]);

    const commit = generarIdentificadorDeCommit();
    const procesador = crearProcesadorDesdeRegistro(
      registro,
      cargadorFijo(entradaFixture(commit)),
    );

    // Trabajo sintético con id de variante de extensión (fuera del union de producto).
    const trabajo = {
      id: 'pubjob_test',
      commit,
      variante: 'mock-b' as VarianteDePublicacion,
      estado: 'pendiente' as const,
      intentos: 0,
      creadoEn: 1,
      actualizadoEn: 1,
    };

    const resultado = await procesador(trabajo);
    expect(resultado.ok).toBe(true);
  });

  it('la capa genérica no hardcodea el nombre determinista', () => {
    const raiz = path.resolve(import.meta.dirname);
    const fuentes = ['orquestar-publicacion.ts', 'registro-de-variantes.ts', 'variante-de-formato.ts'];
    for (const nombre of fuentes) {
      const texto = fs.readFileSync(path.join(raiz, nombre), 'utf8');
      expect(texto).not.toMatch(/markdown-determinista/);
      expect(texto).not.toMatch(/determinista/);
    }
  });
});
