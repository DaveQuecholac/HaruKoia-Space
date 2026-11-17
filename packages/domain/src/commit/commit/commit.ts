/**
 * Commit de pizarra: versión oficial del estado de trabajo (toda la pizarra, D-H4-1).
 * El snapshot Yjs y el JSON viven referidos por `id` (1:1 con la fila de snapshot).
 * Sin documents ni attachments (H5/H6).
 */

import { comoIdentificadorDeSala, type IdentificadorDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import {
  comoIdentificadorDeCommit,
  generarIdentificadorDeCommit,
  type IdentificadorDeCommit,
} from '../identificador-de-commit/identificador-de-commit.ts';

export type Commit = {
  readonly id: IdentificadorDeCommit;
  readonly sala: IdentificadorDeSala;
  /** Null solo en el primer commit de la sala. */
  readonly padre: IdentificadorDeCommit | null;
  readonly mensaje: string;
  readonly autor: string;
  readonly participantes: readonly string[];
  /** Reloj del host, en milisegundos. */
  readonly creadoEn: number;
};

export type DatosParaCrearCommit = {
  readonly sala: IdentificadorDeSala;
  readonly padre: IdentificadorDeCommit | null;
  readonly mensaje: string;
  readonly autor: string;
  readonly participantes: readonly string[];
  readonly creadoEn: number;
  readonly id?: IdentificadorDeCommit;
};

export type ResultadoDeCommit =
  | { readonly ok: true; readonly commit: Commit }
  | {
      readonly ok: false;
      readonly causa:
        | 'mensaje-invalido'
        | 'autor-vacio'
        | 'participantes-invalidos'
        | 'creado-en-invalido';
    };

export function crearCommit(datos: DatosParaCrearCommit): ResultadoDeCommit {
  if (typeof datos.mensaje !== 'string') {
    return { ok: false, causa: 'mensaje-invalido' };
  }
  if (typeof datos.autor !== 'string' || datos.autor.trim() === '') {
    return { ok: false, causa: 'autor-vacio' };
  }
  if (!esListaDeNombres(datos.participantes)) {
    return { ok: false, causa: 'participantes-invalidos' };
  }
  if (!Number.isFinite(datos.creadoEn) || datos.creadoEn < 0) {
    return { ok: false, causa: 'creado-en-invalido' };
  }

  return {
    ok: true,
    commit: {
      id: datos.id ?? generarIdentificadorDeCommit(),
      sala: datos.sala,
      padre: datos.padre,
      mensaje: datos.mensaje,
      autor: datos.autor.trim(),
      participantes: Object.freeze([...datos.participantes]),
      creadoEn: datos.creadoEn,
    },
  };
}

/** Interpreta un objeto crudo (p. ej. fila leída) como `Commit`, o falla. */
export function comoCommit(valor: unknown): Commit {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new TypeError('commit inválido');
  }
  const datos = valor as Record<string, unknown>;
  const creado = crearCommit({
    id: comoIdentificadorDeCommit(datos.id),
    sala: comoIdentificadorDeSala(datos.sala),
    padre: datos.padre === null || datos.padre === undefined ? null : comoIdentificadorDeCommit(datos.padre),
    mensaje: String(datos.mensaje ?? ''),
    autor: String(datos.autor ?? ''),
    participantes: Array.isArray(datos.participantes)
      ? (datos.participantes as unknown[]).map(String)
      : [],
    creadoEn: Number(datos.creadoEn),
  });
  if (!creado.ok) {
    throw new TypeError(`commit inválido: ${creado.causa}`);
  }
  return creado.commit;
}

function esListaDeNombres(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor) && valor.every((n) => typeof n === 'string');
}
