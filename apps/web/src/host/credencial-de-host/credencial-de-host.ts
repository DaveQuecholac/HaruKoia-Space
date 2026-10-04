/**
 * Credencial de host de esta pestaña en una sala. Fijado en B8: el token de
 * la web del host llega solo por "Volverme host" y se presenta al conectar.
 * El rol lo decide el host al verlo; la web no lo afirma.
 *
 * Se guarda por pestaña (`sessionStorage`) para que recargar no la pierda, y
 * no viaja en el link: quien entra por link es espectador.
 */

import { type IdentificadorDeSala, type TokenDeWebDelHost, comoTokenDeWebDelHost } from '@harukoia/domain';

const clave = (sala: IdentificadorDeSala) => `harukoia:credencial-de-host:${sala}`;

export function guardarCredencialDeHost(
  almacen: Pick<Storage, 'setItem'>,
  sala: IdentificadorDeSala,
  token: TokenDeWebDelHost,
): void {
  almacen.setItem(clave(sala), token);
}

export function leerCredencialDeHost(
  almacen: Pick<Storage, 'getItem'>,
  sala: IdentificadorDeSala,
): TokenDeWebDelHost | undefined {
  const guardado = almacen.getItem(clave(sala));
  if (!guardado) return undefined;
  try {
    return comoTokenDeWebDelHost(guardado);
  } catch {
    // Alterado a mano: sin credencial válida, la pestaña entra como espectador.
    return undefined;
  }
}
