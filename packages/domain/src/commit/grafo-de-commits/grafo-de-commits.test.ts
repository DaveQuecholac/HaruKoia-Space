import { describe, expect, it } from 'vitest';

import { generarIdentidadDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import { crearCommit } from '../commit/commit.ts';
import { generarIdentificadorDeCommit } from '../identificador-de-commit/identificador-de-commit.ts';
import { ordenarHistorial, validarPadreDelCommit } from './grafo-de-commits.ts';

describe('grafo de commits', () => {
  const sala = generarIdentidadDeSala().sala;

  it('acepta la raíz cuando el historial está vacío', () => {
    expect(validarPadreDelCommit([], null)).toEqual({ ok: true });
  });

  it('rechaza un padre inventado en el primer commit', () => {
    expect(validarPadreDelCommit([], generarIdentificadorDeCommit())).toEqual({
      ok: false,
      causa: 'padre-inexistente',
    });
  });

  it('rechaza una segunda raíz (F-V4)', () => {
    const raiz = crearCommit({
      sala,
      padre: null,
      mensaje: 'uno',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 1,
    });
    expect(raiz.ok).toBe(true);
    if (!raiz.ok) return;
    expect(validarPadreDelCommit([raiz.commit], null)).toEqual({
      ok: false,
      causa: 'raiz-ya-existe',
    });
  });

  it('acepta un hijo colgado de un commit existente', () => {
    const raiz = crearCommit({
      sala,
      padre: null,
      mensaje: 'uno',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 1,
    });
    expect(raiz.ok).toBe(true);
    if (!raiz.ok) return;
    expect(validarPadreDelCommit([raiz.commit], raiz.commit.id)).toEqual({ ok: true });
  });

  it('ordena por creadoEn y desempata por id', () => {
    const a = crearCommit({
      sala,
      padre: null,
      mensaje: 'a',
      autor: 'A',
      participantes: [],
      creadoEn: 2,
      id: generarIdentificadorDeCommit(),
    });
    const b = crearCommit({
      sala,
      padre: null,
      mensaje: 'b',
      autor: 'B',
      participantes: [],
      creadoEn: 1,
      id: generarIdentificadorDeCommit(),
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(ordenarHistorial([a.commit, b.commit]).map((c) => c.mensaje)).toEqual(['b', 'a']);
  });
});
