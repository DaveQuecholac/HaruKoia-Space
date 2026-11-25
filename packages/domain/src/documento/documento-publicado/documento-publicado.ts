/**
 * Documento publicado (H5): artefacto generado a partir de un commit de pizarra.
 * No es el Doc Yjs de la sala ni un Identificador<'commit'>.
 * Adjuntos PDF/Word: H6 (no entran aquí).
 */

import {
  comoIdentificadorDeCommit,
  type IdentificadorDeCommit,
} from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import { comoIdentificadorDeSala, type IdentificadorDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import {
  comoIdentificadorDeDocumento,
  generarIdentificadorDeDocumento,
  type IdentificadorDeDocumento,
} from '../identificador-de-documento/identificador-de-documento.ts';
import { comoEstadoDePush, type EstadoDePush } from '../estado-de-push/estado-de-push.ts';
import {
  comoRutaPublicada,
  rutasDePublicacionDelCommit,
  type RutasDePublicacion,
} from '../rutas-publicadas/rutas-publicadas.ts';
import {
  esVarianteDePublicacion,
  type VarianteDePublicacion,
} from '../variante-de-publicacion/variante-de-publicacion.ts';

export type DocumentoPublicado = {
  readonly id: IdentificadorDeDocumento;
  readonly sala: IdentificadorDeSala;
  /** Commit de pizarra del que sale este documento. */
  readonly commit: IdentificadorDeCommit;
  readonly variante: VarianteDePublicacion;
  readonly estado: EstadoDePush;
  readonly rutas: RutasDePublicacion;
  /** Reloj del host al crear el registro. */
  readonly creadoEn: number;
};

export type DatosParaCrearDocumentoPublicado = {
  readonly sala: IdentificadorDeSala;
  readonly commit: IdentificadorDeCommit;
  readonly variante: VarianteDePublicacion;
  readonly estado: EstadoDePush;
  readonly creadoEn: number;
  readonly id?: IdentificadorDeDocumento;
  /** Si se omiten, se usan las rutas canónicas del commit (D-H5-5). */
  readonly rutas?: RutasDePublicacion;
};

export type ResultadoDeDocumentoPublicado =
  | { readonly ok: true; readonly documento: DocumentoPublicado }
  | {
      readonly ok: false;
      readonly causa:
        | 'variante-invalida'
        | 'estado-invalido'
        | 'creado-en-invalido'
        | 'ruta-invalida';
    };

export function crearDocumentoPublicado(
  datos: DatosParaCrearDocumentoPublicado,
): ResultadoDeDocumentoPublicado {
  if (!esVarianteDePublicacion(datos.variante)) {
    return { ok: false, causa: 'variante-invalida' };
  }
  if (!Number.isFinite(datos.creadoEn) || datos.creadoEn < 0) {
    return { ok: false, causa: 'creado-en-invalido' };
  }

  const rutas = datos.rutas ?? rutasDePublicacionDelCommit(datos.commit);
  for (const relativa of [rutas.directorio, rutas.tableroJson, rutas.documentoMarkdown]) {
    if (!comoRutaPublicada(relativa).ok) {
      return { ok: false, causa: 'ruta-invalida' };
    }
  }

  return {
    ok: true,
    documento: {
      id: datos.id ?? generarIdentificadorDeDocumento(),
      sala: datos.sala,
      commit: datos.commit,
      variante: datos.variante,
      estado: datos.estado,
      rutas: {
        directorio: rutas.directorio,
        tableroJson: rutas.tableroJson,
        documentoMarkdown: rutas.documentoMarkdown,
      },
      creadoEn: datos.creadoEn,
    },
  };
}

export function comoDocumentoPublicado(valor: unknown): DocumentoPublicado {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new TypeError('documento publicado inválido');
  }
  const datos = valor as Record<string, unknown>;
  const estado = comoEstadoDePush(datos.estado);
  if (!estado.ok) {
    throw new TypeError(`documento publicado inválido: estado (${estado.causa})`);
  }

  const rutasCrudas = datos.rutas;
  let rutas: RutasDePublicacion | undefined;
  if (rutasCrudas !== null && typeof rutasCrudas === 'object' && !Array.isArray(rutasCrudas)) {
    const r = rutasCrudas as Record<string, unknown>;
    rutas = {
      directorio: String(r.directorio ?? ''),
      tableroJson: String(r.tableroJson ?? ''),
      documentoMarkdown: String(r.documentoMarkdown ?? ''),
    };
  }

  const creado = crearDocumentoPublicado({
    id: comoIdentificadorDeDocumento(datos.id),
    sala: comoIdentificadorDeSala(datos.sala),
    commit: comoIdentificadorDeCommit(datos.commit),
    variante: datos.variante as VarianteDePublicacion,
    estado: estado.estado,
    creadoEn: Number(datos.creadoEn),
    ...(rutas !== undefined ? { rutas } : {}),
  });
  if (!creado.ok) {
    throw new TypeError(`documento publicado inválido: ${creado.causa}`);
  }
  return creado.documento;
}
