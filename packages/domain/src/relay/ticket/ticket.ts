/**
 * Ticket de emparejamiento. Fijado en el paso B3, decisión 2.
 *
 * El orquestador emite uno **por invitado** y el host lo devuelve al abrir su
 * conexión de datos. Sirve para probar que esa conexión viene del host dueño de
 * la sala, sin que el **token de host** tenga que viajar en cada entrada: ese
 * token recupera la sala y más adelante autoriza los commits, así que mientras
 * menos veces salga, mejor.
 *
 * Es de un solo uso y caduca en segundos. Un ticket filtrado sirve para un
 * emparejamiento y nada más.
 */

import {
  type Identificador,
  comoIdentificador,
  generarIdentificador,
} from '../../identificador/identificador.ts';
import { LONGITUD_DEL_TOKEN } from '../../sala/identidad-de-sala/identidad-de-sala.ts';

export type Ticket = Identificador<'ticket'>;

export function generarTicket(): Ticket {
  return generarIdentificador<'ticket'>(LONGITUD_DEL_TOKEN);
}

export function comoTicket(valor: unknown): Ticket {
  return comoIdentificador<'ticket'>(valor, LONGITUD_DEL_TOKEN);
}
