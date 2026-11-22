import { resolve } from 'node:path';

/**
 * El SQLite del harness vive bajo pruebas/replica-central/tmp/.
 * Nunca apps/host/data/sala.sqlite (F-R7 / R4).
 */
export function rutaDelSqliteDelHarness(
  raizPrueba: string,
  relativa = 'tmp/host-harness.db',
): {
  readonly dbLocation: string;
  readonly dbFilename: string;
  readonly absoluta: string;
} {
  if (relativa.includes('sala.sqlite') || relativa.includes('apps/host')) {
    throw new Error(`ruta de harness prohibida: ${relativa}`);
  }
  const tmp = resolve(raizPrueba, 'tmp');
  const absoluta = resolve(raizPrueba, relativa);
  if (absoluta !== tmp && !absoluta.startsWith(`${tmp}/`)) {
    throw new Error(`el SQLite del harness debe vivir bajo ${tmp}, no ${absoluta}`);
  }
  return {
    dbLocation: resolve(absoluta, '..'),
    dbFilename: absoluta.slice(resolve(absoluta, '..').length + 1),
    absoluta,
  };
}
