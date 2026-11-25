/**
 * Rutas de generados bajo D-H5-5: prefijo `harukoia/publicado/…`.
 * Convención P1: un directorio por commit de pizarra.
 *
 *   harukoia/publicado/<commitId>/tablero.json
 *   harukoia/publicado/<commitId>/documento.md
 *
 * Nunca rutas absolutas, `..`, ni fuera del prefijo.
 */

import type { IdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';

export const PREFIJO_PUBLICADO = 'harukoia/publicado' as const;

export const NOMBRE_DE_TABLERO_JSON = 'tablero.json' as const;
export const NOMBRE_DE_DOCUMENTO_MD = 'documento.md' as const;

export type RutasDePublicacion = {
  /** Relativa al checkout: …/tablero.json */
  readonly tableroJson: string;
  /** Relativa al checkout: …/documento.md */
  readonly documentoMarkdown: string;
  /** Directorio relativo: harukoia/publicado/<commitId> */
  readonly directorio: string;
};

export type ResultadoDeRutaPublicada =
  | { readonly ok: true; readonly relativa: string }
  | {
      readonly ok: false;
      readonly causa: 'vacia' | 'absoluta' | 'fuera-del-prefijo' | 'traversal' | 'separador-invalido';
    };

/** Rutas canónicas de los dos archivos de H5 para un commit. */
export function rutasDePublicacionDelCommit(commit: IdentificadorDeCommit): RutasDePublicacion {
  const directorio = `${PREFIJO_PUBLICADO}/${commit}`;
  return {
    directorio,
    tableroJson: `${directorio}/${NOMBRE_DE_TABLERO_JSON}`,
    documentoMarkdown: `${directorio}/${NOMBRE_DE_DOCUMENTO_MD}`,
  };
}

/**
 * Valida que `relativa` (posix, sin `./` inicial) quede bajo el prefijo publicado.
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
