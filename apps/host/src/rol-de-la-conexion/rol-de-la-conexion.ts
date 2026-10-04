/**
 * Rol de una conexión a la sala. Fijado en el paso B8, decisión 1.
 *
 * Se decide **una vez**, en la autenticación de Hocuspocus, con el token que
 * presenta la conexión: el de la web del host la hace host, cualquier otro
 * (o ninguno, que llega como texto vacío) la hace espectador. Nada de lo que
 * el cliente mande después lo cambia.
 */

import { timingSafeEqual } from 'node:crypto';

import type { Rol, TokenDeWebDelHost } from '@harukoia/domain';

/** Lo que Hocuspocus guarda de cada conexión, desde `onAuthenticate`. */
export type ContextoDeLaConexion = { readonly rol: Rol };

export function rolDelToken(presentado: string, tokenDeWebDelHost: TokenDeWebDelHost): Rol {
  const dado = Buffer.from(presentado);
  const esperado = Buffer.from(tokenDeWebDelHost);
  if (dado.length !== esperado.length) return 'espectador';
  return timingSafeEqual(dado, esperado) ? 'host' : 'espectador';
}
