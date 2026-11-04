/**
 * Link de invitación. Fijado en B6 con D7: `https://<web>/s/<sala>#<token>`.
 *
 * El token va en el fragmento: el navegador no lo manda a ningún servidor, así
 * que no queda en historiales de proxy ni en logs de acceso.
 */

import {
  type IdentificadorDeSala,
  type TokenDeInvitacion,
  comoIdentificadorDeSala,
  comoTokenDeInvitacion,
} from '@harukoia/domain';

export type Invitacion = {
  readonly sala: IdentificadorDeSala;
  readonly tokenDeInvitacion: TokenDeInvitacion;
};

const PREFIJO = '/s/';

export function crearEnlace(origen: string, invitacion: Invitacion): string {
  return `${origen}${PREFIJO}${invitacion.sala}#${invitacion.tokenDeInvitacion}`;
}

/** Si la ruta es la de una sala, aunque el link venga roto. */
export function esRutaDeSala(ruta: string): boolean {
  return ruta.startsWith(PREFIJO);
}

/** La invitación de un link, o `undefined` si no es un link de sala válido. */
export function leerEnlace(enlace: string): Invitacion | undefined {
  let url: URL;
  try {
    url = new URL(enlace);
  } catch {
    return undefined;
  }
  if (!esRutaDeSala(url.pathname)) return undefined;

  try {
    return {
      sala: comoIdentificadorDeSala(url.pathname.slice(PREFIJO.length)),
      tokenDeInvitacion: comoTokenDeInvitacion(url.hash.slice(1)),
    };
  } catch {
    return undefined;
  }
}
