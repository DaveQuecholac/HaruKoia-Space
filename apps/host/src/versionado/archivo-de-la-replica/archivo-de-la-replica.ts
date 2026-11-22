/**
 * Ruta del SQLite del grafo de commits (espejo local de producto).
 *
 * **No** es `sala.sqlite` (F-V6 / D-R5): el documento Yjs de H3 vive aparte.
 * En V2 este archivo es solo local; V6 cablea la cola PowerSync sobre el mismo
 * contrato de tablas `commits` / `snapshots`.
 *
 * Mismo criterio que `archivo-de-la-sala`: una variable, o `data/replica.sqlite`
 * respecto al cwd del proceso (PM2: `apps/host`).
 */

import path from 'node:path';

export const ARCHIVO_DE_REPLICA_POR_DEFECTO = path.join('data', 'replica.sqlite');

export function archivoDeLaReplica(env: { REPLICA_SQLITE?: string }, cwd: string): string {
  if (env.REPLICA_SQLITE !== undefined) {
    if (env.REPLICA_SQLITE === '') throw new Error('REPLICA_SQLITE está vacía');
    return path.resolve(env.REPLICA_SQLITE);
  }
  return path.resolve(cwd, ARCHIVO_DE_REPLICA_POR_DEFECTO);
}
