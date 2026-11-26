/**
 * Escribe el Word y el PDF al lado del Markdown ya guardado.
 * No reescribe el Markdown y no llama al modelo.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PREFIJO_DOCUMENTOS } from '@harukoia/domain';

import { type FormatoDeSalida } from './bloques.ts';
import { pdfDelMarkdown } from './pdf.ts';
import { wordDelMarkdown } from './word.ts';

export type RutasConvertidas = {
  readonly word: string;
  readonly pdf: string;
};

export function rutaDeMarkdown(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const ruta = valor.trim().replaceAll('\\', '/');
  if (!ruta.startsWith(`${PREFIJO_DOCUMENTOS}/`) || !ruta.endsWith('.md')) return null;
  if (ruta.includes('..') || ruta.includes('//')) return null;
  const nombre = ruta.slice(PREFIJO_DOCUMENTOS.length + 1);
  if (nombre.includes('/') || nombre === '.md') return null;
  return ruta;
}

export async function escribirConversiones(
  raizDelCheckout: string,
  rutaMarkdown: string,
  markdown: string,
): Promise<RutasConvertidas> {
  const ruta = rutaDeMarkdown(rutaMarkdown);
  if (!ruta) throw new Error('ruta de markdown inválida');
  const salidas = {
    word: bytesDe('word', markdown),
    pdf: bytesDe('pdf', markdown),
  };
  const base = ruta.slice(0, -'.md'.length);
  const word = `${base}.docx`;
  const pdf = `${base}.pdf`;
  await writeFile(absoluta(raizDelCheckout, word), salidas.word);
  await writeFile(absoluta(raizDelCheckout, pdf), salidas.pdf);
  return { word, pdf };
}

/** Lee el Markdown que ya está en disco y vuelve a escribir Word y PDF. No toca el .md. */
export async function reintentarConversion(raizDelCheckout: string, rutaMarkdown: string): Promise<RutasConvertidas> {
  const ruta = rutaDeMarkdown(rutaMarkdown);
  if (!ruta) throw new Error('ruta de markdown inválida');
  const archivo = absoluta(raizDelCheckout, ruta);
  const antes = await readFile(archivo);
  const resultado = await escribirConversiones(raizDelCheckout, ruta, antes.toString('utf8'));
  const despues = await readFile(archivo);
  if (!antes.equals(despues)) throw new Error('el markdown cambió');
  return resultado;
}

function bytesDe(formato: FormatoDeSalida, markdown: string): Uint8Array {
  if (formato === 'word') return wordDelMarkdown(markdown);
  return pdfDelMarkdown(markdown);
}

function absoluta(raizDelCheckout: string, relativa: string): string {
  const raiz = path.resolve(raizDelCheckout);
  const prefijo = path.resolve(raiz, ...PREFIJO_DOCUMENTOS.split('/'));
  const destino = path.resolve(raiz, ...relativa.split('/'));
  if (!destino.startsWith(prefijo + path.sep)) throw new Error('fuera de documentacion');
  return destino;
}
