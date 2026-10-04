/**
 * Qué respuestas del orquestador **no** se arreglan reintentando. Fijado en B4.
 *
 * Reintentar un rechazo definitivo no cambia nada y llena los logs; dejar de
 * reintentar uno temporal deja al host fuera para siempre. Los dos mapas son
 * `Record` sobre las uniones del contrato a propósito: una causa nueva no
 * compila hasta que alguien decide de qué lado cae.
 */

import type { CausaDeCierre, CausaDeRechazo } from '@harukoia/domain';

const RECHAZO_DEFINITIVO: Readonly<Record<CausaDeRechazo, boolean>> = {
  'sala-ocupada-por-otro-host': true,
  'token-de-host-invalido': true,
  'token-de-invitacion-invalido': true,
  'sala-no-encontrada': false,
  'ticket-invalido': true,
  'emparejamiento-expirado': false,
  'mensaje-no-reconocido': true,
  'mensaje-mal-formado': true,
  'canal-no-soportado': true,
};

/**
 * - `host-sin-latido`: el registro caducó; volver a registrarse lo arregla.
 * - `host-reemplazado`: otra instancia con el mismo token tomó la sala (D5).
 *   Pelearla produciría un ir y venir entre las dos.
 * - `host-cerro-la-sala`: lo pidió este mismo host.
 */
const CIERRE_DEFINITIVO: Readonly<Record<CausaDeCierre, boolean>> = {
  'host-sin-latido': false,
  'host-reemplazado': true,
  'host-cerro-la-sala': true,
};

export function esRechazoDefinitivo(causa: CausaDeRechazo): boolean {
  return RECHAZO_DEFINITIVO[causa];
}

export function esCierreDefinitivo(causa: CausaDeCierre): boolean {
  return CIERRE_DEFINITIVO[causa];
}
