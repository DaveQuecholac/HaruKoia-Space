/**
 * Cierre de sala para los invitados. Fijado en el paso B7.
 *
 * Después de emparejarse, la conexión del invitado solo lleva bytes: el
 * control ya no puede viajar por ella. Para que el invitado distinga "el host
 * cerró la sala" de "se cayó la red", el orquestador cierra su conexión con
 * este código y la causa como razón del cierre.
 *
 * Rango de aplicación de WebSocket (4000–4999).
 */

import { CAUSAS_DE_CIERRE, type CausaDeCierre } from '../mensaje-de-control/mensaje-de-control.ts';

export const CODIGO_DE_SALA_CERRADA = 4410;

/** La causa de un cierre con `CODIGO_DE_SALA_CERRADA`, si la razón es una conocida. */
export function causaDelCierreDeSala(codigo: number, razon: string): CausaDeCierre | undefined {
  if (codigo !== CODIGO_DE_SALA_CERRADA) return undefined;
  return CAUSAS_DE_CIERRE.find((causa) => causa === razon);
}
