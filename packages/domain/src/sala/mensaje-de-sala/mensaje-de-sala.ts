/**
 * Mensajes entre un participante y el host de su sala. Fijado en el paso B8.
 *
 * Viajan como mensajes sin estado de Hocuspocus, dentro de la conexión de la
 * sala: el orquestador no los ve como control, solo como bytes del túnel.
 * Son otro plano que los mensajes de control del relay, y por eso viven aparte.
 */

import type { AccionDeSala, CausaDeAccionRechazada } from '../accion-de-sala/accion-de-sala.ts';
import type { TokenDeInvitacion } from '../identidad-de-sala/identidad-de-sala.ts';
import type { Rol } from '../rol/rol.ts';

/** Participante → host. */
export type MensajeDelParticipante = { readonly tipo: 'pedir-accion'; readonly accion: AccionDeSala };

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
  | { readonly tipo: 'invitacion-cambiada'; readonly tokenDeInvitacion: TokenDeInvitacion };

export type MensajeDeSala = MensajeDelParticipante | MensajeDelHostDeLaSala;

export type TipoDeMensajeDeSala = MensajeDeSala['tipo'];
