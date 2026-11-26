/**
 * Rutas de generados bajo D-H5-5 (actualizado 2026-11-25).
 *
 * Raíz del checkout del proyecto (toplevel git):
 *
 *   Harukoia/Pizarra/<YYYY-MM-DD_HHMM__autor__mensaje__id8>/tablero.json
 *   Harukoia/Pizarra/<…>/documento.md
 *   Harukoia/documentacion/…   ← salidas de IA (H6; reservado)
 *
 * El segmento de carpeta es legible (momento + autor + mensaje) y único
 * (8 primeros caracteres del id del commit de pizarra).
 * Sin compatibilidad con carpetas solo-id ni con `harukoia/publicado/…`.
 */

import type { IdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';

/** Carpeta raíz en el repo del equipo. */
export const PREFIJO_RAIZ_HARUKOIA = 'Harukoia' as const;

/** Publicaciones de pizarra (H5): coordenadas / tablero / markdown determinista. */
export const PREFIJO_PUBLICADO = `${PREFIJO_RAIZ_HARUKOIA}/Pizarra` as const;

/** Documentos generados por IA (H6). Reservado; aún no escribe el motor. */
export const PREFIJO_DOCUMENTOS = `${PREFIJO_RAIZ_HARUKOIA}/documentacion` as const;

export const NOMBRE_DE_TABLERO_JSON = 'tablero.json' as const;
export const NOMBRE_DE_DOCUMENTO_MD = 'documento.md' as const;

/** Longitud del sufijo del id de commit en el nombre de carpeta. */
export const LONGITUD_SUFIJO_DE_COMMIT = 8 as const;

export type DatosParaRutasDePublicacion = {
  readonly commit: IdentificadorDeCommit;
  /** Epoch ms del commit de pizarra (marca de tiempo de la carpeta). */
  readonly creadoEn: number;
  readonly autor: string;
  readonly mensaje: string;
};

export type RutasDePublicacion = {
  /** Relativa al checkout: …/tablero.json */
  readonly tableroJson: string;
  /** Relativa al checkout: …/documento.md */
  readonly documentoMarkdown: string;
  /** Directorio relativo bajo Harukoia/Pizarra/… */
  readonly directorio: string;
};

export type ResultadoDeRutaPublicada =
  | { readonly ok: true; readonly relativa: string }
  | {
      readonly ok: false;
      readonly causa: 'vacia' | 'absoluta' | 'fuera-del-prefijo' | 'traversal' | 'separador-invalido';
    };

/** Slug seguro para un segmento de ruta (sin `/`, `.`, `..`). */
export function slugParaSegmentoDeRuta(texto: string, maxLength: number): string {
  const base = texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return base === '' ? 'x' : base;
}

/** `YYYY-MM-DD_HHMM` en hora local del proceso. */
export function marcaTemporalDeCarpeta(creadoEn: number): string {
  const d = new Date(creadoEn);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dd}_${hh}${mi}`;
}

/**
 * Nombre de carpeta: `YYYY-MM-DD_HHMM__autor__mensaje__id8` (opción C).
 */
export function nombreDeCarpetaPublicada(datos: DatosParaRutasDePublicacion): string {
  const cuando = marcaTemporalDeCarpeta(datos.creadoEn);
  const autor = slugParaSegmentoDeRuta(datos.autor, 24);
  const mensaje = slugParaSegmentoDeRuta(datos.mensaje, 40);
  const id8 = String(datos.commit).slice(0, LONGITUD_SUFIJO_DE_COMMIT);
  return `${cuando}__${autor}__${mensaje}__${id8}`;
}

/** Rutas canónicas de los dos archivos de H5 para un commit. */
export function rutasDePublicacionDelCommit(
  datos: DatosParaRutasDePublicacion,
): RutasDePublicacion {
  const directorio = `${PREFIJO_PUBLICADO}/${nombreDeCarpetaPublicada(datos)}`;
  return {
    directorio,
    tableroJson: `${directorio}/${NOMBRE_DE_TABLERO_JSON}`,
    documentoMarkdown: `${directorio}/${NOMBRE_DE_DOCUMENTO_MD}`,
  };
}

/**
 * Valida que `relativa` (posix, sin `./` inicial) quede bajo el prefijo de pizarra.
 * No resuelve el filesystem: solo el contrato de path.
 */
export function comoRutaPublicada(relativa: unknown): ResultadoDeRutaPublicada {
  if (typeof relativa !== 'string' || relativa.trim() === '') {
    return { ok: false, causa: 'vacia' };
  }
  const ruta = relativa.trim().replaceAll('\\', '/');
  if (ruta.startsWith('/') || /^[a-zA-Z]:\//.test(ruta)) {
    return { ok: false, causa: 'absoluta' };
  }
  if (ruta.includes('\0') || ruta.includes('//')) {
    return { ok: false, causa: 'separador-invalido' };
  }
  const partes = ruta.split('/');
  if (partes.some((p) => p === '' || p === '.' || p === '..')) {
    return { ok: false, causa: 'traversal' };
  }
  if (ruta !== PREFIJO_PUBLICADO && !ruta.startsWith(`${PREFIJO_PUBLICADO}/`)) {
    return { ok: false, causa: 'fuera-del-prefijo' };
  }
  return { ok: true, relativa: ruta };
}
