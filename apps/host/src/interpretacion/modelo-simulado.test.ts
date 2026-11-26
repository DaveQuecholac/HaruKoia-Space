import { describe, expect, it } from 'vitest';

import { interpretarConModeloSimulado } from './modelo-simulado.ts';

describe('modelo simulado', () => {
  it('la misma imagen da el mismo Markdown de interpretación', () => {
    const imagen = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const primero = interpretarConModeloSimulado(imagen);
    const segundo = interpretarConModeloSimulado(Uint8Array.from(imagen));
    expect(primero).toBe(segundo);
    expect(primero.startsWith('# Interpretación')).toBe(true);
    expect(interpretarConModeloSimulado(Uint8Array.from([9]))).not.toBe(primero);
  });
});
