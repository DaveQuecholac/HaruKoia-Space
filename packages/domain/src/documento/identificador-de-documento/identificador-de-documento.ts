import {
  LONGITUD_MINIMA,
  type Identificador,
  comoIdentificador,
  generarIdentificador,
} from '../../identificador/identificador.ts';

/** Identificador de un documento publicado (H5). No es asignable a commit ni sala. */
export type IdentificadorDeDocumento = Identificador<'documento'>;

export const LONGITUD_DEL_DOCUMENTO = LONGITUD_MINIMA;

export function generarIdentificadorDeDocumento(): IdentificadorDeDocumento {
  return generarIdentificador<'documento'>(LONGITUD_DEL_DOCUMENTO);
}

export function comoIdentificadorDeDocumento(valor: unknown): IdentificadorDeDocumento {
  return comoIdentificador<'documento'>(valor, LONGITUD_DEL_DOCUMENTO);
}
