/**
 * Reglas del grafo de commits (H4). Sin almacenamiento.
 * F-V4: el padre debe existir cuando el historial no está vacío;
 * el raíz solo admite `padre: null`.
 */

import type { Commit } from '../commit/commit.ts';
import type { IdentificadorDeCommit } from '../identificador-de-commit/identificador-de-commit.ts';

export type ResultadoDePadre =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly causa: 'padre-inexistente' | 'raiz-ya-existe';
    };

/**
 * Valida el `padre` de un commit nuevo respecto al historial ya guardado
 * de la misma sala (sin borrados).
 */
export function validarPadreDelCommit(
  historial: readonly Pick<Commit, 'id' | 'padre'>[],
  padre: IdentificadorDeCommit | null,
): ResultadoDePadre {
  if (historial.length === 0) {
    if (padre !== null) {
      return { ok: false, causa: 'padre-inexistente' };
    }
    return { ok: true };
  }

  if (padre === null) {
    return { ok: false, causa: 'raiz-ya-existe' };
  }

  if (!historial.some((c) => c.id === padre)) {
    return { ok: false, causa: 'padre-inexistente' };
  }

  return { ok: true };
}

/** Historial en orden de creación (raíz primero). Desempate por id. */
export function ordenarHistorial<T extends Pick<Commit, 'id' | 'creadoEn'>>(commits: readonly T[]): T[] {
  return [...commits].sort((a, b) => {
    if (a.creadoEn !== b.creadoEn) return a.creadoEn - b.creadoEn;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}
