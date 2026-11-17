import { describe, expect, it } from 'vitest';

import {
  FORMATO_DE_TABLERO,
  interpretarTableroEnJson,
  tableroEnJsonVacio,
} from './formato-de-tablero.ts';

const pagina = {
  tipo: 'pagina' as const,
  id: 'page:inicio',
  nombre: 'Inicio',
  indice: 'a0',
  meta: {},
};

describe('formato de tablero', () => {
  it('el vacío usa la versión 1', () => {
    expect(tableroEnJsonVacio()).toEqual({ formato: FORMATO_DE_TABLERO, formas: [] });
    expect(FORMATO_DE_TABLERO).toBe(1);
  });

  it('acepta un sobre con formas válidas', () => {
    const resultado = interpretarTableroEnJson({ formato: 1, formas: [pagina] });
    expect(resultado).toEqual({
      ok: true,
      tablero: { formato: 1, formas: [pagina] },
    });
  });

  it('rechaza formato desconocido sin fallback', () => {
    expect(interpretarTableroEnJson({ formato: 2, formas: [] })).toEqual({
      ok: false,
      causa: 'formato-desconocido',
    });
  });

  it('rechaza forma de tipo desconocido', () => {
    expect(
      interpretarTableroEnJson({ formato: 1, formas: [{ tipo: 'marco', id: 'x' }] }),
    ).toEqual({ ok: false, causa: 'forma-desconocida' });
  });

  it('rechaza cargas inválidos', () => {
    expect(interpretarTableroEnJson(null).ok).toBe(false);
    expect(interpretarTableroEnJson({ formas: [] })).toEqual({
      ok: false,
      causa: 'formato-ausente',
    });
    expect(interpretarTableroEnJson({ formato: 1, formas: 'x' })).toEqual({
      ok: false,
      causa: 'formas-invalidas',
    });
  });
});
