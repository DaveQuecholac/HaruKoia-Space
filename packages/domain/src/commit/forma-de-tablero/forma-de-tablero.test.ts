import { describe, expect, it } from 'vitest';

import { interpretarForma } from './forma-de-tablero.ts';

describe('forma de tablero', () => {
  it('acepta una figura válida', () => {
    const resultado = interpretarForma({
      tipo: 'figura',
      id: 'shape:1',
      figura: 'geo',
      x: 10,
      y: 20,
      rotacion: 0,
      indice: 'a1',
      padre: 'page:inicio',
      bloqueado: false,
      opacidad: 1,
      props: { w: 100, h: 50 },
      meta: {},
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.forma.tipo).toBe('figura');
  });

  it('rechaza un tipo desconocido sin silencio', () => {
    expect(interpretarForma({ tipo: 'marco', id: 'x' })).toEqual({
      ok: false,
      causa: 'tipo-desconocido',
    });
  });

  it('rechaza campos incompletos', () => {
    expect(interpretarForma({ tipo: 'pagina', id: 'page:1', nombre: 'A' })).toEqual({
      ok: false,
      causa: 'campos-invalidos',
    });
  });
});
