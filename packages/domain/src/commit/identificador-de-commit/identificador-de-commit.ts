import {
  LONGITUD_MINIMA,
  type Identificador,
  comoIdentificador,
  generarIdentificador,
} from '../../identificador/identificador.ts';

/** Identificador de un commit de pizarra. No es asignable a `Identificador<'sala'>`. */
export type IdentificadorDeCommit = Identificador<'commit'>;

export const LONGITUD_DEL_COMMIT = LONGITUD_MINIMA;

export function generarIdentificadorDeCommit(): IdentificadorDeCommit {
  return generarIdentificador<'commit'>(LONGITUD_DEL_COMMIT);
}

export function comoIdentificadorDeCommit(valor: unknown): IdentificadorDeCommit {
  return comoIdentificador<'commit'>(valor, LONGITUD_DEL_COMMIT);
}
