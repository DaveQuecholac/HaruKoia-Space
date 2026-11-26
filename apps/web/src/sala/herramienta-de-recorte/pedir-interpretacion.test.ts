import { describe, expect, it, vi } from 'vitest';

import { pedirInterpretacion } from './pedir-interpretacion.ts';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('pedir interpretación', () => {
  it('manda solo la imagen y devuelve el Markdown', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const cuerpo = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(Object.keys(cuerpo)).toEqual(['imagen', 'nombre']);
      expect(cuerpo.imagen).toBe(btoa(String.fromCharCode(...png)));
      expect(cuerpo.nombre).toBe('Perros bonitos');
      return new Response(
        JSON.stringify({
          markdown: '# Zona\n\nUn perro.',
          ruta: 'Harukoia/documentacion/Perros bonitos.md',
          word: 'Harukoia/documentacion/Perros bonitos.docx',
          pdf: 'Harukoia/documentacion/Perros bonitos.pdf',
        }),
        { status: 200 },
      );
    });

    const resultado = await pedirInterpretacion({
      urlDelHost: 'https://host.harukoia.local.iokoia.dev',
      tokenDeWebDelHost: 'token-web',
      nombre: 'Perros bonitos',
      imagen: new Blob([png], { type: 'image/png' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(resultado).toEqual({
      ok: true,
      markdown: '# Zona\n\nUn perro.',
      ruta: 'Harukoia/documentacion/Perros bonitos.md',
      word: 'Harukoia/documentacion/Perros bonitos.docx',
      pdf: 'Harukoia/documentacion/Perros bonitos.pdf',
    });
  });

  it('sin token no llama al host', async () => {
    const fetchImpl = vi.fn();
    const resultado = await pedirInterpretacion({
      urlDelHost: 'https://host.harukoia.local.iokoia.dev',
      tokenDeWebDelHost: undefined,
      nombre: 'Perros bonitos',
      imagen: new Blob([png], { type: 'image/png' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(resultado).toEqual({ ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('si el host falla, no hay Markdown', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'no se pudo interpretar la zona' }), { status: 502 }));
    const resultado = await pedirInterpretacion({
      urlDelHost: 'https://host.harukoia.local.iokoia.dev',
      tokenDeWebDelHost: 'token-web',
      nombre: 'Perros bonitos',
      imagen: new Blob([png], { type: 'image/png' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(resultado).toEqual({ ok: false });
  });
});
