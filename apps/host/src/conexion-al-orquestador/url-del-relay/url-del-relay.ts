import type { Ruta } from '@harukoia/domain';

/**
 * Pega una ruta del relay a la URL base del orquestador **conservando** el
 * camino de la base. `new URL('/relay/control', base)` lo descartaría, y un
 * orquestador publicado bajo un prefijo dejaría de encontrarse.
 */
export function urlDelRelay(base: string, ruta: Ruta): string {
  const conBarra = base.endsWith('/') ? base : `${base}/`;
  return new URL(ruta.slice(1), conBarra).toString();
}
