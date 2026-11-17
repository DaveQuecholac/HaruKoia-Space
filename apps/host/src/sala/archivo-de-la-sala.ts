/**
 * Ruta del SQLite del documento de la sala. E1, cerrada el 2026-11-12.
 *
 * El mismo criterio que la system DB de Space: una variable, y si no está,
 * `data/sala.sqlite` respecto al directorio de trabajo del proceso. PM2
 * arranca este host con cwd `apps/host`.
 */

import path from 'node:path';

export const ARCHIVO_POR_DEFECTO = path.join('data', 'sala.sqlite');

export function archivoDeLaSala(env: { SALA_SQLITE?: string }, cwd: string): string {
  if (env.SALA_SQLITE !== undefined) {
    if (env.SALA_SQLITE === '') throw new Error('SALA_SQLITE está vacía');
    return path.resolve(env.SALA_SQLITE);
  }
  return path.resolve(cwd, ARCHIVO_POR_DEFECTO);
}
