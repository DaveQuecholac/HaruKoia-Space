/**
 * Qué rechazos de entrada se arreglan solos con el tiempo. Fijado en el paso
 * B7, decisión 1.
 *
 * Definitivo: reintentar da lo mismo (el token no sirve, o el cliente y el
 * orquestador no hablan la misma versión). Temporal: el host está volviendo o
 * el emparejamiento perdió una carrera, y otro intento puede entrar.
 *
 * `Record` para que una causa nueva no compile sin decidir su naturaleza.
 */

import type { CausaDeRechazoDeEntrada } from '../socket-del-relay/socket-del-relay.ts';

export type NaturalezaDelRechazo = 'temporal' | 'definitivo';

const NATURALEZA: Readonly<Record<CausaDeRechazoDeEntrada, NaturalezaDelRechazo>> = {
  'sala-ocupada-por-otro-host': 'definitivo',
  'token-de-host-invalido': 'definitivo',
  'token-de-invitacion-invalido': 'definitivo',
  'sala-no-encontrada': 'temporal',
  'ticket-invalido': 'temporal',
  'emparejamiento-expirado': 'temporal',
  'mensaje-no-reconocido': 'definitivo',
  'mensaje-mal-formado': 'definitivo',
  'canal-no-soportado': 'definitivo',
  'respuesta-inesperada': 'definitivo',
};

export function naturalezaDelRechazo(causa: CausaDeRechazoDeEntrada): NaturalezaDelRechazo {
  return NATURALEZA[causa];
}
