import { describe, expect, it } from 'vitest';

import { esVarianteDePublicacion } from './variante-de-publicacion.ts';

describe('variante de publicación', () => {
  it('acepta markdown-determinista y rechaza otras', () => {
    expect(esVarianteDePublicacion('markdown-determinista')).toBe(true);
    expect(esVarianteDePublicacion('markdown-con-ia')).toBe(false);
    expect(esVarianteDePublicacion('pdf')).toBe(false);
  });
});
