/**
 * Mensajes de control del relay. Fijado en B1 y ampliado en B3.
 *
 * Dos planos separados a propósito:
 *
 * - **Control**: estos mensajes. Estructurados, poco frecuentes.
 * - **Datos**: bytes opacos por las conexiones de datos. El relay no los mira
 *   y aquí no se describen.
 *
 * Una conexión de invitado y una de datos **empiezan hablando control** —su
 * primer mensaje se identifica— y después de emparejarse solo transportan
 * bytes. El control no vuelve a aparecer en ellas.
 *
 * Nada de vocabulario de pizarra en este archivo. Si aparece la palabra trazo,
 * figura o lienzo, está en la capa equivocada.
 */

import type {
  IdentificadorDeSala,
  TokenDeHost,
  TokenDeInvitacion,
} from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import type { Canal } from '../canal/canal.ts';
import type { IdentificadorDeConexion } from '../conexion/conexion.ts';
import type { Ticket } from '../ticket/ticket.ts';

/** Por qué el orquestador rechaza algo. Siempre con causa: nunca un silencio. */
export const CAUSAS_DE_RECHAZO = [
  'sala-ocupada-por-otro-host',
  'token-de-host-invalido',
  'token-de-invitacion-invalido',
  'sala-no-encontrada',
  'ticket-invalido',
  'emparejamiento-expirado',
  'mensaje-no-reconocido',
  'mensaje-mal-formado',
  'canal-no-soportado',
] as const;

export type CausaDeRechazo = (typeof CAUSAS_DE_RECHAZO)[number];

/** Por qué una sala dejó de existir. `host-reemplazado` es la decisión D5. */
export const CAUSAS_DE_CIERRE = [
  'host-cerro-la-sala',
  'host-sin-latido',
  'host-reemplazado',
] as const;

export type CausaDeCierre = (typeof CAUSAS_DE_CIERRE)[number];

/**
 * Host → orquestador.
 *
 * `registrar` y `latido` van por la conexión de control. `emparejar` es el
 * primer mensaje de una conexión de **datos**, y lleva el ticket que prueba que
 * esa conexión viene del host dueño de la sala (decisión 2 de B3).
 */
export type MensajeDelHost =
  | {
      readonly tipo: 'registrar';
      readonly sala: IdentificadorDeSala;
      readonly tokenDeHost: TokenDeHost;
      readonly tokenDeInvitacion: TokenDeInvitacion;
    }
  | { readonly tipo: 'latido' }
  | { readonly tipo: 'cerrar-sala' }
  /** El link anterior deja de servir; quien ya entró sigue dentro. Añadido en B8. */
  | { readonly tipo: 'cambiar-invitacion'; readonly tokenDeInvitacion: TokenDeInvitacion }
  | {
      readonly tipo: 'emparejar';
      readonly conexion: IdentificadorDeConexion;
      readonly ticket: Ticket;
    };

/**
 * Invitado → orquestador. Un solo mensaje, el primero de su conexión.
 *
 * El token viaja aquí y no en la URL (decisión 3 de B3) para que no quede
 * escrito en los logs de acceso del proxy.
 */
export type MensajeDelInvitado = {
  readonly tipo: 'entrar';
  readonly sala: IdentificadorDeSala;
  readonly tokenDeInvitacion: TokenDeInvitacion;
};

/** Orquestador → host o invitado. */
export type MensajeDelOrquestador =
  | { readonly tipo: 'registro-aceptado'; readonly sala: IdentificadorDeSala }
  | { readonly tipo: 'registro-rechazado'; readonly causa: CausaDeRechazo }
  /** Confirmación de `cambiar-invitacion`: desde aquí solo vale el token nuevo. */
  | { readonly tipo: 'invitacion-cambiada' }
  | {
      readonly tipo: 'entra-invitado';
      readonly conexion: IdentificadorDeConexion;
      readonly canal: Canal;
      readonly ticket: Ticket;
    }
  | { readonly tipo: 'sale-invitado'; readonly conexion: IdentificadorDeConexion }
  | { readonly tipo: 'sala-cerrada'; readonly causa: CausaDeCierre }
  | { readonly tipo: 'entrada-aceptada'; readonly conexion: IdentificadorDeConexion }
  | { readonly tipo: 'entrada-rechazada'; readonly causa: CausaDeRechazo }
  /**
   * Primer y único mensaje de control que recibe una conexión de datos del
   * host cuando su ticket vale. Sin él, el host no distinguiría un rechazo de
   * los primeros bytes del invitado. Añadido en B4.
   */
  | { readonly tipo: 'emparejamiento-aceptado'; readonly conexion: IdentificadorDeConexion }
  | { readonly tipo: 'emparejamiento-rechazado'; readonly causa: CausaDeRechazo };

export type MensajeDeControl = MensajeDelHost | MensajeDelInvitado | MensajeDelOrquestador;

export type TipoDeMensaje = MensajeDeControl['tipo'];

export const TIPOS_DEL_HOST = ['registrar', 'latido', 'cerrar-sala', 'cambiar-invitacion', 'emparejar'] as const;

export const TIPOS_DEL_INVITADO = ['entrar'] as const;

export const TIPOS_DEL_ORQUESTADOR = [
  'registro-aceptado',
  'registro-rechazado',
  'invitacion-cambiada',
  'entra-invitado',
  'sale-invitado',
  'sala-cerrada',
  'entrada-aceptada',
  'entrada-rechazada',
  'emparejamiento-aceptado',
  'emparejamiento-rechazado',
] as const;
