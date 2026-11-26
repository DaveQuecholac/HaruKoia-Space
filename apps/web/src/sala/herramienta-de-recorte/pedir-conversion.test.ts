import { describe, expect, it, vi } from 'vitest';

import { pedirConversion } from './pedir-conversion.ts';

describe('reintentar la conversión', () => {
  it('manda solo la ruta del Markdown y no la imagen', async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://host.harukoia.local.iokoia.dev/interpretacion/convertir');
      const cuerpo = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(Object.keys(cuerpo)).toEqual(['ruta']);
      return new Response(
        JSON.stringify({
          word: 'Harukoia/documentacion/Junta.docx',
          pdf: 'Harukoia/documentacion/Junta.pdf',
        }),
        { status: 200 },
      );
    });

    const resultado = await pedirConversion({
      urlDelHost: 'https://host.harukoia.local.iokoia.dev',
      tokenDeWebDelHost: 'token-web',
      ruta: 'Harukoia/documentacion/Junta.md',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(resultado).toEqual({
      ok: true,
      word: 'Harukoia/documentacion/Junta.docx',
      pdf: 'Harukoia/documentacion/Junta.pdf',
    });
  });
});
