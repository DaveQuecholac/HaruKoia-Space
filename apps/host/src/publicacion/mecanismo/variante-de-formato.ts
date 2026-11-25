/**
 * Plugin de variante de formato del mecanismo de publicación (H5 / P4 / H5-T5).
 *
 * La capa genérica no conoce nombres de producto: solo el `id` del plugin
 * y el contrato de entrada / artefactos.
 */

import type {
  IdentificadorDeCommit,
  TableroEnJson,
} from '@harukoia/domain';

import type { ArtefactoDePublicacion } from './artefacto-de-publicacion.ts';
import type { TrabajoDePublicacion } from '../trabajo-de-publicacion/trabajo-de-publicacion.ts';

/** Datos del commit de pizarra que consume cualquier variante. */
export type EntradaDePublicacion = {
  readonly commit: {
    readonly id: IdentificadorDeCommit;
    readonly mensaje: string;
    readonly autor: string;
    readonly participantes: readonly string[];
    readonly creadoEn: number;
  };
  readonly tablero: TableroEnJson;
};

export type ContextoDeVariante = {
  readonly trabajo: TrabajoDePublicacion;
  readonly entrada: EntradaDePublicacion;
};

export type ResultadoDeVariante =
  | { readonly ok: true; readonly artefactos: readonly ArtefactoDePublicacion[] }
  | { readonly ok: false; readonly causa: string };

/**
 * Variante = plugin. `id` debe coincidir con `trabajo.variante` al orquestar.
 * Agregar una variante nueva = registrar otro plugin; no bifurcar la tubería.
 */
export type VarianteDeFormato = {
  readonly id: string;
  producir(contexto: ContextoDeVariante): Promise<ResultadoDeVariante>;
};
