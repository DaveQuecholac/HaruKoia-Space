/**
 * Artefacto en memoria producido por una variante de formato (H5 / P4).
 * La escritura al working tree es P6; git es P7.
 */

import { comoRutaPublicada } from '@harukoia/domain';

export type ArtefactoDePublicacion = {
  /** Ruta relativa al checkout, bajo `harukoia/publicado/…`. */
  readonly rutaRelativa: string;
  readonly bytes: Uint8Array;
};

export type ResultadoDeArtefacto =
  | { readonly ok: true; readonly artefacto: ArtefactoDePublicacion }
  | { readonly ok: false; readonly causa: 'ruta-invalida' | 'bytes-vacios' };

export function crearArtefactoDePublicacion(
  rutaRelativa: string,
  bytes: Uint8Array,
): ResultadoDeArtefacto {
  const ruta = comoRutaPublicada(rutaRelativa);
  if (!ruta.ok) return { ok: false, causa: 'ruta-invalida' };
  if (bytes.byteLength === 0) return { ok: false, causa: 'bytes-vacios' };
  return { ok: true, artefacto: { rutaRelativa: ruta.relativa, bytes } };
}
