/**
 * Mensajes entre un participante y el host de su sala. Fijado en el paso B8;
 * `commitear` / `commit-guardado` en H4 / V3; `historial` en H4 / V4.
 *
 * Viajan como mensajes sin estado de Hocuspocus, dentro de la conexión de la
 * sala: el orquestador no los ve como control, solo como bytes del túnel.
 * Son otro plano que los mensajes de control del relay, y por eso viven aparte.
 */

import type { IdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import type { AccionDeSala, CausaDeAccionRechazada } from '../accion-de-sala/accion-de-sala.ts';
import type { TokenDeInvitacion } from '../identidad-de-sala/identidad-de-sala.ts';
import type { Rol } from '../rol/rol.ts';

/** Resumen de un commit para la lista de historial (H4-T6). Sin snapshot ni JSON. */
export type EntradaDeHistorial = {
  readonly id: IdentificadorDeCommit;
  readonly mensaje: string;
  readonly autor: string;
  readonly creadoEn: number;
  readonly padre: IdentificadorDeCommit | null;
};

/** Participante → host. El payload depende de la acción. */
export type MensajeDelParticipante =
  | { readonly tipo: 'pedir-accion'; readonly accion: 'cambiar-invitacion' }
  | { readonly tipo: 'pedir-accion'; readonly accion: 'commitear'; readonly mensaje: string }
  | {
      readonly tipo: 'pedir-accion';
      readonly accion: 'hacer-checkout';
      readonly id: IdentificadorDeCommit;
    };

/** Host → participante. */
export type MensajeDelHostDeLaSala =
  /** Al conectarse: el rol que el host le dio a esta conexión. */
  | { readonly tipo: 'tu-rol'; readonly rol: Rol }
  | {
      readonly tipo: 'accion-rechazada';
      readonly accion: AccionDeSala;
      readonly causa: CausaDeAccionRechazada;
    }
  /** Solo a las conexiones host: el link anterior ya no sirve para entrar. */
  | { readonly tipo: 'invitacion-cambiada'; readonly tokenDeInvitacion: TokenDeInvitacion }
  /**
   * Snapshot del historial al conectar (V4). Orden: más antiguo primero.
   * `tip` = commit del estado de trabajo actual (V5); el siguiente commit cuelga de él.
   * Hasta V6 se lee vía host/sala, no PowerSync.
   */
  | {
      readonly tipo: 'historial';
      readonly commits: readonly EntradaDeHistorial[];
      readonly tip: IdentificadorDeCommit | null;
    }
  /** Commit local aceptado (V3). Destino: todos (historial visible en lectura). */
  | {
      readonly tipo: 'commit-guardado';
      readonly id: IdentificadorDeCommit;
      readonly mensaje: string;
      readonly autor: string;
      readonly creadoEn: number;
      readonly padre: IdentificadorDeCommit | null;
    }
  /** Estado de trabajo = ese commit (V5). Destino: todos. */
  | { readonly tipo: 'checkout-hecho'; readonly id: IdentificadorDeCommit };

export type MensajeDeSala = MensajeDelParticipante | MensajeDelHostDeLaSala;

export type TipoDeMensajeDeSala = MensajeDeSala['tipo'];

export type PedidoDeAccion = Extract<MensajeDelParticipante, { tipo: 'pedir-accion' }>;
