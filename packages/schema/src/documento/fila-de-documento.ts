/**
 * Fila mínima de la colección `documents` (H5).
 * Markdown (+ rutas) por commit, con estado de push.
 * Sin attachments binarios (H6).
 *
 * `actualizadoEn` lo asigna el host (DocumentoReplicado).
 */

import type { DocumentoReplicado } from '../documento-replicado/documento-replicado.ts';

export const NOMBRE_DE_COLECCION_DOCUMENTS = 'documents' as const;

/** Campos de producto de H5 en `documents`. Nada de PDF/Word. */
export const CAMPOS_DE_DOCUMENTO_H5 = [
  'id',
  'actualizadoEn',
  'borrado',
  'sala',
  'commit',
  'variante',
  'estadoTipo',
  'estadoCausa',
  'estadoMarca',
  'rutaDirectorio',
  'rutaTableroJson',
  'rutaDocumentoMarkdown',
  'creadoEn',
] as const;

export type FilaDeDocumento = DocumentoReplicado & {
  readonly sala: string;
  /** Id del commit de pizarra. */
  readonly commit: string;
  readonly variante: string;
  /** en-proceso | publicado | fallido */
  readonly estadoTipo: string;
  /** Causa si fallido; null en otro caso. */
  readonly estadoCausa: string | null;
  /** publicadoEn o fallidoEn; null si en-proceso. */
  readonly estadoMarca: number | null;
  readonly rutaDirectorio: string;
  readonly rutaTableroJson: string;
  readonly rutaDocumentoMarkdown: string;
  readonly creadoEn: number;
};

export type ResultadoDeFilaDeDocumento =
  | { readonly ok: true; readonly fila: FilaDeDocumento }
  | {
      readonly ok: false;
      readonly causa:
        | 'no-objeto'
        | 'id-invalido'
        | 'sala-invalida'
        | 'commit-invalido'
        | 'variante-invalida'
        | 'estado-tipo-invalido'
        | 'estado-causa-invalida'
        | 'estado-marca-invalida'
        | 'ruta-invalida'
        | 'creado-en-invalido'
        | 'actualizado-en-invalido'
        | 'borrado-invalido';
    };

const TIPOS_DE_ESTADO = new Set(['en-proceso', 'publicado', 'fallido']);

export function comoFilaDeDocumento(valor: unknown): ResultadoDeFilaDeDocumento {
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
  if (typeof datos.commit !== 'string' || datos.commit.length === 0) {
    return { ok: false, causa: 'commit-invalido' };
  }
  if (typeof datos.variante !== 'string' || datos.variante.length === 0) {
    return { ok: false, causa: 'variante-invalida' };
  }
  if (typeof datos.estadoTipo !== 'string' || !TIPOS_DE_ESTADO.has(datos.estadoTipo)) {
    return { ok: false, causa: 'estado-tipo-invalido' };
  }

  const estadoTipo = datos.estadoTipo;
  let estadoCausa: string | null;
  let estadoMarca: number | null;

  if (estadoTipo === 'en-proceso') {
    if (datos.estadoCausa !== null && datos.estadoCausa !== undefined) {
      return { ok: false, causa: 'estado-causa-invalida' };
    }
    if (datos.estadoMarca !== null && datos.estadoMarca !== undefined) {
      return { ok: false, causa: 'estado-marca-invalida' };
    }
    estadoCausa = null;
    estadoMarca = null;
  } else if (estadoTipo === 'publicado') {
    if (datos.estadoCausa !== null && datos.estadoCausa !== undefined) {
      return { ok: false, causa: 'estado-causa-invalida' };
    }
    if (!Number.isFinite(datos.estadoMarca) || (datos.estadoMarca as number) < 0) {
      return { ok: false, causa: 'estado-marca-invalida' };
    }
    estadoCausa = null;
    estadoMarca = datos.estadoMarca as number;
  } else {
    if (typeof datos.estadoCausa !== 'string' || datos.estadoCausa.trim() === '') {
      return { ok: false, causa: 'estado-causa-invalida' };
    }
    if (!Number.isFinite(datos.estadoMarca) || (datos.estadoMarca as number) < 0) {
      return { ok: false, causa: 'estado-marca-invalida' };
    }
    estadoCausa = datos.estadoCausa.trim();
    estadoMarca = datos.estadoMarca as number;
  }

  for (const clave of ['rutaDirectorio', 'rutaTableroJson', 'rutaDocumentoMarkdown'] as const) {
    if (typeof datos[clave] !== 'string' || (datos[clave] as string).length === 0) {
      return { ok: false, causa: 'ruta-invalida' };
    }
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
      commit: datos.commit,
      variante: datos.variante,
      estadoTipo,
      estadoCausa,
      estadoMarca,
      rutaDirectorio: datos.rutaDirectorio as string,
      rutaTableroJson: datos.rutaTableroJson as string,
      rutaDocumentoMarkdown: datos.rutaDocumentoMarkdown as string,
      creadoEn: datos.creadoEn as number,
    },
  };
}
