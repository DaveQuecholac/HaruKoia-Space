import { readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';

import { SignJWT } from 'jose';

export type OpcionesDeJwt = {
  readonly rutaClavePrivada: string;
  readonly kid: string;
  readonly audience: string;
  readonly sala: string;
  readonly subject?: string;
  readonly segundosDeVida?: number;
};

/** JWT RS256 de lectura para PowerSync (D-R3). Alcance de sala en el claim `sala`. */
export async function emitirTokenDeLectura(opciones: OpcionesDeJwt): Promise<string> {
  const pem = readFileSync(opciones.rutaClavePrivada);
  const clave = createPrivateKey(pem);
  const vida = opciones.segundosDeVida ?? 60 * 60;
  // `sala` queda como claim; sync-config lo lee con auth.parameter('sala').
  return new SignJWT({ sala: opciones.sala })
    .setProtectedHeader({ alg: 'RS256', kid: opciones.kid })
    .setSubject(opciones.subject ?? `sala:${opciones.sala}`)
    .setAudience(opciones.audience)
    .setIssuedAt()
    .setExpirationTime(`${vida}s`)
    .sign(clave);
}
