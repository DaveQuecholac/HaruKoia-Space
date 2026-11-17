/**
 * Fila mínima de la colección `snapshots` (H4).
 * `id` = id del commit (1:1). Solo H4: sin documents ni attachments.
 *
 * El JSON del tablero viaja como texto; la versión de formato va en
 * `formatoDeTablero` (dominio: FORMATO_DE_TABLERO = 1).
 */

import type { DocumentoReplicado } from '../documento-replicado/documento-replicado.ts';

export const NOMBRE_DE_COLECCION_SNAPSHOTS = 'snapshots' as const;

/** Campos de producto de H4 en `snapshots`. Nada de documents/attachments. */
export const CAMPOS_DE_SNAPSHOT_H4 = [
  'id',
  'actualizadoEn',
  'borrado',
  'estadoYjsBase64',
  'tableroJson',
  'formatoDeTablero',
] as const;

export type FilaDeSnapshot = DocumentoReplicado & {
  /** Snapshot Yjs codificado en base64. */
  readonly estadoYjsBase64: string;
  /** JSON del tablero (sobre con `formato` + `formas`), serializado. */
  readonly tableroJson: string;
  readonly formatoDeTablero: number;
};

export type ResultadoDeFilaDeSnapshot =
  | { readonly ok: true; readonly fila: FilaDeSnapshot }
  | {
      readonly ok: false;
      readonly causa:
        | 'no-objeto'
        | 'id-invalido'
        | 'estado-yjs-invalido'
        | 'tablero-json-invalido'
        | 'formato-invalido'
        | 'actualizado-en-invalido'
        | 'borrado-invalido';
    };

export function comoFilaDeSnapshot(valor: unknown): ResultadoDeFilaDeSnapshot {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'no-objeto' };
  }
  const datos = valor as Record<string, unknown>;

  if (typeof datos.id !== 'string' || datos.id.length === 0) {
    return { ok: false, causa: 'id-invalido' };
  }
  if (typeof datos.estadoYjsBase64 !== 'string') {
    return { ok: false, causa: 'estado-yjs-invalido' };
  }
  if (typeof datos.tableroJson !== 'string') {
    return { ok: false, causa: 'tablero-json-invalido' };
  }
  if (!Number.isInteger(datos.formatoDeTablero) || (datos.formatoDeTablero as number) < 1) {
    return { ok: false, causa: 'formato-invalido' };
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
      estadoYjsBase64: datos.estadoYjsBase64,
      tableroJson: datos.tableroJson,
      formatoDeTablero: datos.formatoDeTablero as number,
    },
  };
}
