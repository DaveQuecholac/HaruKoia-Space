/**
 * Invitación del host para la web de su máquina. Fijado en el paso B6.
 *
 * "Volverme host" en la web no arranca nada: le pide aquí la invitación al
 * host que ya corre en la máquina. Devuelve sala y token de invitación,
 * **nunca** el token de host.
 *
 * Dos candados, porque el token de invitación da acceso a la sala:
 *
 *   - **Solo desde la propia máquina.** En desarrollo el proxy de portless
 *     llega por loopback. En un servidor, detrás de su proxy, la petición viene
 *     de otra dirección y se rechaza.
 *   - **Solo al origen de la web configurado.** Sin esto, cualquier página
 *     abierta en el navegador podría pedir el token.
 *
 * Sin `WEB_ORIGEN` la ruta no existe: un host sin web en su máquina, como el
 * de una sala global, no la necesita.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { IdentidadDeSala } from '@harukoia/domain';

export const RUTA_DE_INVITACION = '/invitacion';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function esDeLaPropiaMaquina(direccion: string | undefined): boolean {
  return direccion !== undefined && LOOPBACK.has(direccion);
}

export type OpcionesDeLaInvitacion = {
  readonly identidad: IdentidadDeSala;
  readonly origenDeLaWeb: string;
};

/** Atiende `GET /invitacion`. Devuelve `false` si la petición no es para esta ruta. */
export function atenderInvitacion(
  req: IncomingMessage,
  res: ServerResponse,
  opciones: OpcionesDeLaInvitacion,
): boolean {
  if (req.url !== RUTA_DE_INVITACION) return false;

  const permitido =
    req.method === 'GET' &&
    esDeLaPropiaMaquina(req.socket.remoteAddress) &&
    req.headers.origin === opciones.origenDeLaWeb;

  if (!permitido) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invitación solo para la web de esta máquina' }));
    return true;
  }

  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': opciones.origenDeLaWeb,
    vary: 'Origin',
    'cache-control': 'no-store',
  });
  res.end(
    JSON.stringify({
      sala: opciones.identidad.sala,
      tokenDeInvitacion: opciones.identidad.tokenDeInvitacion,
    }),
  );
  return true;
}
