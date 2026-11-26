/**
 * Guarda el Markdown de la interpretación en la raíz git del proyecto.
 * Si el título ya tiene archivo, el siguiente es «título v2.md», luego «v3», y así.
 * No pisa el archivo anterior. No toca Harukoia/Pizarra.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PREFIJO_DOCUMENTOS } from '@harukoia/domain';

const TOPE_DE_VERSION = 99;

export function tituloDeDocumento(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const titulo = valor.trim();
  if (titulo === '' || titulo === '.' || titulo === '..') return null;
  if (titulo.length > 80) return null;
  if (/[\\/\0]/.test(titulo)) return null;
  return titulo;
}

/** La primera versión no lleva sufijo. Desde la segunda: «título v2.md». */
export function nombreDeArchivo(titulo: string, version: number): string {
  if (version <= 1) return `${titulo}.md`;
  return `${titulo} v${version}.md`;
}

export async function guardarDocumento(raizDelCheckout: string, titulo: string, markdown: string): Promise<string> {
  const nombre = tituloDeDocumento(titulo);
  if (!nombre) throw new Error('título inválido');
  if (markdown.trim() === '') throw new Error('markdown vacío');

  const raiz = path.resolve(raizDelCheckout);
  const prefijo = path.resolve(raiz, ...PREFIJO_DOCUMENTOS.split('/'));
  await mkdir(prefijo, { recursive: true });

  for (let version = 1; version <= TOPE_DE_VERSION; version += 1) {
    const archivo = nombreDeArchivo(nombre, version);
    const absoluta = path.resolve(prefijo, archivo);
    if (!absoluta.startsWith(prefijo + path.sep)) throw new Error('fuera de documentacion');
    try {
      await writeFile(absoluta, markdown, { encoding: 'utf8', flag: 'wx' });
      return `${PREFIJO_DOCUMENTOS}/${archivo}`;
    } catch (error) {
      if (yaExiste(error)) continue;
      throw error;
    }
  }
  throw new Error('no hay versión libre');
}

function yaExiste(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
