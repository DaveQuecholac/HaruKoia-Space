/**
 * Rol de esta pestaña en una sala. Fijado en B6: quien llegó por "Volverme
 * host" es el host; quien llegó por link, invitado. Se guarda por pestaña
 * (`sessionStorage`) para que recargar no lo convierta en invitado.
 *
 * **Falsificable hasta B8:** viaja en la presencia y cualquiera puede decir
 * que es host. B8 lo resuelve donde no se puede falsificar.
 */

import type { IdentificadorDeSala } from '@harukoia/domain';

export const ROLES = ['host', 'invitado'] as const;
export type Rol = (typeof ROLES)[number];

export function esRol(valor: unknown): valor is Rol {
  return ROLES.includes(valor as Rol);
}

const clave = (sala: IdentificadorDeSala) => `harukoia:rol:${sala}`;

export function marcarComoHost(almacen: Pick<Storage, 'setItem'>, sala: IdentificadorDeSala): void {
  almacen.setItem(clave(sala), 'host');
}

export function rolEnLaPestana(almacen: Pick<Storage, 'getItem'>, sala: IdentificadorDeSala): Rol {
  return almacen.getItem(clave(sala)) === 'host' ? 'host' : 'invitado';
}
