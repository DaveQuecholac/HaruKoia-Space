import { readFile, rm, unlink } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bloquesDelMarkdown } from './bloques.ts';
import { escribirConversiones, reintentarConversion } from './escribir-conversiones.ts';
import { pdfDelMarkdown } from './pdf.ts';
import { wordDelMarkdown } from './word.ts';

const markdown = '# Junta\n\nUn perro **bonito**.';

let raiz: string | undefined;

afterEach(async () => {
  if (raiz) await rm(raiz, { recursive: true, force: true });
  raiz = undefined;
});

describe('convertidor propio', () => {
  it('pasa el Markdown a Word y a PDF sin tocar el archivo de origen', async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'harukoia-conv-'));
    const relativa = 'Harukoia/documentacion/Junta.md';
    const archivo = path.join(raiz, relativa);
    await import('node:fs/promises').then(({ mkdir, writeFile }) =>
      mkdir(path.dirname(archivo), { recursive: true }).then(() => writeFile(archivo, markdown)),
    );
    const antes = await readFile(archivo);

    const rutas = await escribirConversiones(raiz, relativa, markdown);

    expect(rutas).toEqual({
      word: 'Harukoia/documentacion/Junta.docx',
      pdf: 'Harukoia/documentacion/Junta.pdf',
    });
    expect(Buffer.from(await readFile(path.join(raiz, rutas.word))).subarray(0, 2).toString()).toBe('PK');
    expect((await readFile(path.join(raiz, rutas.word))).includes(Buffer.from('Junta'))).toBe(true);
    expect((await readFile(path.join(raiz, rutas.pdf))).subarray(0, 5).toString()).toBe('%PDF-');
    expect(await readFile(archivo)).toEqual(antes);
    expect(bloquesDelMarkdown(markdown)).toEqual([
      { tipo: 'titulo', nivel: 1, texto: 'Junta' },
      { tipo: 'parrafo', texto: 'Un perro bonito.' },
    ]);
  });

  it('borrar el Word y reintentar deja el Markdown intacto', async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'harukoia-conv-'));
    const relativa = 'Harukoia/documentacion/Junta.md';
    const archivo = path.join(raiz, relativa);
    await import('node:fs/promises').then(({ mkdir, writeFile }) =>
      mkdir(path.dirname(archivo), { recursive: true }).then(() => writeFile(archivo, markdown)),
    );
    const rutas = await escribirConversiones(raiz, relativa, markdown);
    const antes = await readFile(archivo);
    await unlink(path.join(raiz, rutas.word));

    const otraVez = await reintentarConversion(raiz, relativa);

    expect(otraVez.word).toBe(rutas.word);
    expect(await readFile(archivo)).toEqual(antes);
    expect((await readFile(path.join(raiz, otraVez.word))).includes(Buffer.from('Junta'))).toBe(true);
  });

  it('el convertidor no importa el modelo ni un conversor externo', async () => {
    const fuente = await readFile(new URL('./escribir-conversiones.ts', import.meta.url), 'utf8');
    const word = await readFile(new URL('./word.ts', import.meta.url), 'utf8');
    const pdf = await readFile(new URL('./pdf.ts', import.meta.url), 'utf8');
    const paquete = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
    for (const texto of [fuente, word, pdf, paquete]) {
      expect(texto.toLowerCase()).not.toContain('pandoc');
      expect(texto).not.toContain('modelo-simulado');
      expect(texto).not.toContain('llamar-a-bedrock');
    }
    expect(wordDelMarkdown('# A').byteLength).toBeGreaterThan(0);
    expect(pdfDelMarkdown('# A').byteLength).toBeGreaterThan(0);
  });
});
