import { describe, expect, it } from 'vitest';

import { TEXTO_DE_AYUDA } from './ayuda.ts';
import { run } from '../main.ts';

describe('ayuda space (P9 / D-H5-3)', () => {
  it('documenta solo host, status y update', () => {
    expect(TEXTO_DE_AYUDA).toMatch(/space host/);
    expect(TEXTO_DE_AYUDA).toMatch(/space status/);
    expect(TEXTO_DE_AYUDA).toMatch(/space update/);
    expect(TEXTO_DE_AYUDA).not.toMatch(/unirse/);
    expect(TEXTO_DE_AYUDA).not.toMatch(/todavía sin implementar/);
  });

  it('--help sale 0 y no menciona otros comandos de producto', async () => {
    const escrituras: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      escrituras.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const codigo = await run(['--help']);
      expect(codigo).toBe(0);
      const texto = escrituras.join('');
      expect(texto).toContain('space host');
      expect(texto).toContain('space status');
      expect(texto).toContain('space update');
      expect(texto).not.toContain('join');
    } finally {
      process.stdout.write = original;
    }
  });

  it('comando desconocido falla', async () => {
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      expect(await run(['join'])).toBe(1);
    } finally {
      process.stderr.write = original;
    }
  });
});
