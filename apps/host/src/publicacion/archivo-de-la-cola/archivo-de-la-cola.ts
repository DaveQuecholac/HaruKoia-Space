/**
 * Ruta del archivo de la cola de publicación (H5 / P3).
 *
 * Persistencia en disco del host. **No** es `sala.sqlite` ni `replica.sqlite`.
 * PM2 arranca el host con cwd `apps/host`.
 */

import path from 'node:path';

export const ARCHIVO_DE_COLA_POR_DEFECTO = path.join('data', 'cola-publicacion.json');

export function archivoDeLaCola(env: { COLA_PUBLICACION?: string }, cwd: string): string {
  if (env.COLA_PUBLICACION !== undefined) {
    if (env.COLA_PUBLICACION === '') throw new Error('COLA_PUBLICACION está vacía');
    return path.resolve(env.COLA_PUBLICACION);
  }
  return path.resolve(cwd, ARCHIVO_DE_COLA_POR_DEFECTO);
}
