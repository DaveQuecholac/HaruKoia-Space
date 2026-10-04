/**
 * Identidad de una sala. Fijado en el paso B1, con la decisión **D4**.
 *
 * Tres valores distintos, y la distinción es el punto:
 *
 * - El **identificador** enruta. Aparece en logs y en mensajes de control, así
 *   que no es secreto y no da acceso a nada.
 * - El **token de host** prueba que eres el dueño. Con él recuperas tu sala
 *   después de una caída (decisión **D5**). No se comparte nunca.
 * - El **token de invitación** da acceso a entrar. Se comparte en el link y se
 *   puede revocar sin cambiar la sala.
 *
 * Confundir el primero con los otros dos es exactamente lo que D4 evita: un
 * identificador visible en un log no debe abrir la puerta.
 */

import {
  type Identificador,
  comoIdentificador,
  generarIdentificador,
} from '../../identificador/identificador.ts';

export type IdentificadorDeSala = Identificador<'sala'>;
export type TokenDeHost = Identificador<'token-de-host'>;
export type TokenDeInvitacion = Identificador<'token-de-invitacion'>;

/** 16 caracteres, 80 bits. Viaja en el link y en los logs; no es secreto. */
export const LONGITUD_DEL_IDENTIFICADOR = 16;

/**
 * 26 caracteres, 130 bits. Los tokens son secretos y el costo de alargarlos es
 * cero: nadie los escribe a mano.
 */
export const LONGITUD_DEL_TOKEN = 26;

export type IdentidadDeSala = {
  readonly sala: IdentificadorDeSala;
  readonly tokenDeHost: TokenDeHost;
  readonly tokenDeInvitacion: TokenDeInvitacion;
};

export function generarIdentidadDeSala(): IdentidadDeSala {
  return {
    sala: generarIdentificador<'sala'>(LONGITUD_DEL_IDENTIFICADOR),
    tokenDeHost: generarIdentificador<'token-de-host'>(LONGITUD_DEL_TOKEN),
    tokenDeInvitacion: generarIdentificador<'token-de-invitacion'>(LONGITUD_DEL_TOKEN),
  };
}

/**
 * Rotar la invitación sin tocar la sala ni el token de host: las sesiones
 * abiertas siguen, los links viejos dejan de servir. Es lo que D4 compra.
 */
export function rotarTokenDeInvitacion(identidad: IdentidadDeSala): IdentidadDeSala {
  return {
    ...identidad,
    tokenDeInvitacion: generarIdentificador<'token-de-invitacion'>(LONGITUD_DEL_TOKEN),
  };
}

export function comoIdentificadorDeSala(valor: unknown): IdentificadorDeSala {
  return comoIdentificador<'sala'>(valor, LONGITUD_DEL_IDENTIFICADOR);
}

export function comoTokenDeHost(valor: unknown): TokenDeHost {
  return comoIdentificador<'token-de-host'>(valor, LONGITUD_DEL_TOKEN);
}

export function comoTokenDeInvitacion(valor: unknown): TokenDeInvitacion {
  return comoIdentificador<'token-de-invitacion'>(valor, LONGITUD_DEL_TOKEN);
}
