import { describe, expect, it } from 'vitest';

import { crearRegistroDeVariantes } from './registro-de-variantes.ts';
import type { VarianteDeFormato } from './variante-de-formato.ts';

function mock(id: string): VarianteDeFormato {
  return {
    id,
    async producir() {
      return { ok: true, artefactos: [] };
    },
  };
}

describe('registro de variantes', () => {
  it('registra y resuelve por id', () => {
    const registro = crearRegistroDeVariantes();
    registro.registrar(mock('mock-a'));
    expect(registro.obtener('mock-a')?.id).toBe('mock-a');
    expect(registro.obtener('ausente')).toBeUndefined();
  });

  it('prueba de extensión: segunda variante mock sin tocar git ni CLI', () => {
    const registro = crearRegistroDeVariantes([mock('mock-a')]);
    registro.registrar(mock('mock-b'));
    expect(registro.ids()).toEqual(['mock-a', 'mock-b']);
    // Extender = solo registrar; no hay imports de git ni cli en este módulo.
  });

  it('rechaza id duplicado', () => {
    const registro = crearRegistroDeVariantes([mock('mock-a')]);
    expect(() => registro.registrar(mock('mock-a'))).toThrow(/ya registrada/);
  });
});
