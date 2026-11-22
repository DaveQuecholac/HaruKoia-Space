import { describe, expect, it } from 'vitest';

import { generarIdentidadDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import { generarIdentificadorDeCommit } from '../identificador-de-commit/identificador-de-commit.ts';
import { comoCommit, crearCommit } from './commit.ts';

describe('commit', () => {
  const sala = generarIdentidadDeSala().sala;

  it('crea un commit raíz con participantes congelados', () => {
    const resultado = crearCommit({
      sala,
      padre: null,
      mensaje: 'primera versión',
      autor: 'Marco',
      participantes: ['Marco', 'Ana'],
      creadoEn: 1_700_000_000_000,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.commit.padre).toBeNull();
    expect(resultado.commit.sala).toBe(sala);
    expect(resultado.commit.autor).toBe('Marco');
    expect(resultado.commit.participantes).toEqual(['Marco', 'Ana']);
    expect(Object.isFrozen(resultado.commit.participantes)).toBe(true);
    expect(resultado.commit.id).toHaveLength(16);
  });

  it('crea un hijo colgado del padre', () => {
    const padre = generarIdentificadorDeCommit();
    const resultado = crearCommit({
      sala,
      padre,
      mensaje: 'ajuste',
      autor: 'Ana',
      participantes: ['Ana'],
      creadoEn: 1,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.commit.padre).toBe(padre);
  });

  it('rechaza autor vacío y creadoEn inválido', () => {
    expect(
      crearCommit({
        sala,
        padre: null,
        mensaje: 'x',
        autor: '   ',
        participantes: [],
        creadoEn: 1,
      }),
    ).toEqual({ ok: false, causa: 'autor-vacio' });

    expect(
      crearCommit({
        sala,
        padre: null,
        mensaje: 'x',
        autor: 'Marco',
        participantes: [],
        creadoEn: Number.NaN,
      }),
    ).toEqual({ ok: false, causa: 'creado-en-invalido' });
  });

  it('comoCommit interpreta un objeto válido', () => {
    const id = generarIdentificadorDeCommit();
    const commit = comoCommit({
      id,
      sala,
      padre: null,
      mensaje: 'ok',
      autor: 'Marco',
      participantes: ['Marco'],
      creadoEn: 10,
    });
    expect(commit.id).toBe(id);
    expect(commit.mensaje).toBe('ok');
  });

  it('comoCommit falla con datos rotos', () => {
    expect(() => comoCommit(null)).toThrow(TypeError);
    expect(() =>
      comoCommit({
        id: 'corto',
        sala,
        padre: null,
        mensaje: 'x',
        autor: 'Marco',
        participantes: [],
        creadoEn: 1,
      }),
    ).toThrow(TypeError);
  });
});
