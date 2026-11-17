import { describe, expect, it } from 'vitest';

import { CAMPOS_DE_COMMIT_H4, NOMBRE_DE_COLECCION_COMMITS, comoFilaDeCommit } from './fila-de-commit.ts';

describe('fila de commit', () => {
  const valida = {
    id: 'abcdefghjkmnpqrs',
    actualizadoEn: 100,
    borrado: false,
    sala: 'abcdefghjkmnpqrt',
    padre: null,
    mensaje: 'primera',
    autor: 'Marco',
    participantes: ['Marco'],
    creadoEn: 90,
  };

  it('nombra la colección commits y lista solo campos H4', () => {
    expect(NOMBRE_DE_COLECCION_COMMITS).toBe('commits');
    expect(CAMPOS_DE_COMMIT_H4).not.toContain('documents');
    expect(CAMPOS_DE_COMMIT_H4).not.toContain('attachments');
  });

  it('acepta una fila mínima válida', () => {
    const resultado = comoFilaDeCommit(valida);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fila.padre).toBeNull();
    expect(resultado.fila.participantes).toEqual(['Marco']);
  });

  it('rechaza filas rotas', () => {
    expect(comoFilaDeCommit(null)).toEqual({ ok: false, causa: 'no-objeto' });
    expect(comoFilaDeCommit({ ...valida, autor: '' })).toEqual({
      ok: false,
      causa: 'autor-invalido',
    });
    expect(comoFilaDeCommit({ ...valida, participantes: 'Marco' })).toEqual({
      ok: false,
      causa: 'participantes-invalidos',
    });
  });
});
