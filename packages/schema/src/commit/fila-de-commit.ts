/**
 * Fila mínima de la colección `commits` (H4).
 * Solo H4: sin documents ni attachments (H5/H6).
 *
 * `id` = identificador del commit. `actualizadoEn` lo asigna el host al aceptar
 * la escritura (DocumentoReplicado).
 */

import type { DocumentoReplicado } from '../documento-replicado/documento-replicado.ts';

export const NOMBRE_DE_COLECCION_COMMITS = 'commits' as const;

/** Campos de producto de H4 en `commits`. Nada de documents/attachments. */
export const CAMPOS_DE_COMMIT_H4 = [
  'id',
  'actualizadoEn',
  'borrado',
  'sala',
  'padre',
  'mensaje',
  'autor',
  'participantes',
  'creadoEn',
] as const;

export type FilaDeCommit = DocumentoReplicado & {
  readonly sala: string;
  /** Null solo en el primer commit de la sala. */
  readonly padre: string | null;
  readonly mensaje: string;
  readonly autor: string;
  readonly participantes: readonly string[];
  /** Reloj del host al crear el commit (dominio). */
  readonly creadoEn: number;
};

export type ResultadoDeFilaDeCommit =
  | { readonly ok: true; readonly fila: FilaDeCommit }
  | {
      readonly ok: false;
      readonly causa:
        | 'no-objeto'
        | 'id-invalido'
        | 'sala-invalida'
        | 'padre-invalido'
        | 'mensaje-invalido'
        | 'autor-invalido'
        | 'participantes-invalidos'
        | 'creado-en-invalido'
        | 'actualizado-en-invalido'
        | 'borrado-invalido';
    };

export function comoFilaDeCommit(valor: unknown): ResultadoDeFilaDeCommit {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'no-objeto' };
  }
  const datos = valor as Record<string, unknown>;

  if (typeof datos.id !== 'string' || datos.id.length === 0) {
    return { ok: false, causa: 'id-invalido' };
  }
  if (typeof datos.sala !== 'string' || datos.sala.length === 0) {
    return { ok: false, causa: 'sala-invalida' };
  }
  if (!(datos.padre === null || (typeof datos.padre === 'string' && datos.padre.length > 0))) {
    return { ok: false, causa: 'padre-invalido' };
  }
  if (typeof datos.mensaje !== 'string') {
    return { ok: false, causa: 'mensaje-invalido' };
  }
  if (typeof datos.autor !== 'string' || datos.autor.length === 0) {
    return { ok: false, causa: 'autor-invalido' };
  }
  if (!Array.isArray(datos.participantes) || !datos.participantes.every((n) => typeof n === 'string')) {
    return { ok: false, causa: 'participantes-invalidos' };
  }
  if (!Number.isFinite(datos.creadoEn) || (datos.creadoEn as number) < 0) {
    return { ok: false, causa: 'creado-en-invalido' };
  }
  if (!Number.isFinite(datos.actualizadoEn) || (datos.actualizadoEn as number) < 0) {
    return { ok: false, causa: 'actualizado-en-invalido' };
  }
  if (typeof datos.borrado !== 'boolean') {
    return { ok: false, causa: 'borrado-invalido' };
  }

  return {
    ok: true,
    fila: {
      id: datos.id,
      actualizadoEn: datos.actualizadoEn as number,
      borrado: datos.borrado,
      sala: datos.sala,
      padre: datos.padre as string | null,
      mensaje: datos.mensaje,
      autor: datos.autor,
      participantes: Object.freeze([...datos.participantes]) as readonly string[],
      creadoEn: datos.creadoEn as number,
    },
  };
}
