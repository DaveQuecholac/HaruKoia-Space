/**
 * Roles de una sala. Fijado en el paso B8.
 *
 * El rol lo decide el host a partir de la conexión, nunca el cliente: el host
 * dueño de la sala, y espectadores. Los espectadores editan el tablero; lo que
 * el rol restringe son las acciones de host.
 */

export const ROLES = ['host', 'espectador'] as const;

export type Rol = (typeof ROLES)[number];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}
