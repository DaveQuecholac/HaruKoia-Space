/**
 * Serialización de los mensajes de control. Fijado en el paso B1.
 *
 * **Texto JSON, y solo para el plano de control.** Los mensajes de control son
 * pocos y conviene leerlos en un log. Los **datos** viajan binarios por su
 * propia conexión y nunca pasan por aquí: envolver binario en texto cuesta un
 * tercio más de tamaño sin ganar nada.
 *
 * El formato vive en este archivo y en ningún otro. Cambiarlo por una
 * codificación binaria el día que haga falta no toca la forma de los mensajes.
 */

import {
  comoIdentificadorDeSala,
  comoTokenDeHost,
  comoTokenDeInvitacion,
} from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import { esCanal } from '../canal/canal.ts';
import { comoIdentificadorDeConexion } from '../conexion/conexion.ts';
import { comoTicket } from '../ticket/ticket.ts';
import {
  CAUSAS_DE_CIERRE,
  CAUSAS_DE_RECHAZO,
  type CausaDeRechazo,
  type MensajeDeControl,
  type TipoDeMensaje,
} from '../mensaje-de-control/mensaje-de-control.ts';

export type Interpretacion =
  | { readonly ok: true; readonly mensaje: MensajeDeControl }
  | { readonly ok: false; readonly causa: CausaDeRechazo; readonly detalle: string };

export function serializarControl(mensaje: MensajeDeControl): string {
  return JSON.stringify(mensaje);
}

/**
 * Error interno del módulo: lo traduce `interpretarControl` a una causa.
 * El campo se declara en el cuerpo, no en el constructor: las propiedades de
 * constructor son una de las construcciones que A5 prohíbe.
 */
class Rechazo extends Error {
  causa: CausaDeRechazo;

  constructor(causa: CausaDeRechazo, detalle: string) {
    super(detalle);
    this.causa = causa;
  }
}

function campoDeTexto(datos: Record<string, unknown>, clave: string): string {
  const valor = datos[clave];
  if (typeof valor !== 'string') {
    throw new Rechazo('mensaje-mal-formado', `falta el campo de texto "${clave}"`);
  }
  return valor;
}

function unoDe<T extends string>(
  datos: Record<string, unknown>,
  clave: string,
  permitidos: readonly T[],
): T {
  const valor = campoDeTexto(datos, clave);
  if (!(permitidos as readonly string[]).includes(valor)) {
    throw new Rechazo('mensaje-mal-formado', `"${clave}" no es un valor reconocido: ${valor}`);
  }
  return valor as T;
}

/**
 * Un lector por tipo de mensaje. Agregar un mensaje al protocolo es agregar una
 * entrada aquí y un miembro a la unión: nada más.
 */
const LECTORES: Record<TipoDeMensaje, (datos: Record<string, unknown>) => MensajeDeControl> = {
  registrar: (datos) => ({
    tipo: 'registrar',
    sala: comoIdentificadorDeSala(campoDeTexto(datos, 'sala')),
    tokenDeHost: comoTokenDeHost(campoDeTexto(datos, 'tokenDeHost')),
    tokenDeInvitacion: comoTokenDeInvitacion(campoDeTexto(datos, 'tokenDeInvitacion')),
  }),
  latido: () => ({ tipo: 'latido' }),
  'cerrar-sala': () => ({ tipo: 'cerrar-sala' }),
  emparejar: (datos) => ({
    tipo: 'emparejar',
    conexion: comoIdentificadorDeConexion(campoDeTexto(datos, 'conexion')),
    ticket: comoTicket(campoDeTexto(datos, 'ticket')),
  }),
  entrar: (datos) => ({
    tipo: 'entrar',
    sala: comoIdentificadorDeSala(campoDeTexto(datos, 'sala')),
    tokenDeInvitacion: comoTokenDeInvitacion(campoDeTexto(datos, 'tokenDeInvitacion')),
  }),
  'registro-aceptado': (datos) => ({
    tipo: 'registro-aceptado',
    sala: comoIdentificadorDeSala(campoDeTexto(datos, 'sala')),
  }),
  'registro-rechazado': (datos) => ({
    tipo: 'registro-rechazado',
    causa: unoDe(datos, 'causa', CAUSAS_DE_RECHAZO),
  }),
  'entra-invitado': (datos) => {
    const canal = campoDeTexto(datos, 'canal');
    if (!esCanal(canal)) {
      throw new Rechazo('canal-no-soportado', `canal desconocido: ${canal}`);
    }
    return {
      tipo: 'entra-invitado',
      conexion: comoIdentificadorDeConexion(campoDeTexto(datos, 'conexion')),
      canal,
      ticket: comoTicket(campoDeTexto(datos, 'ticket')),
    };
  },
  'sale-invitado': (datos) => ({
    tipo: 'sale-invitado',
    conexion: comoIdentificadorDeConexion(campoDeTexto(datos, 'conexion')),
  }),
  'sala-cerrada': (datos) => ({
    tipo: 'sala-cerrada',
    causa: unoDe(datos, 'causa', CAUSAS_DE_CIERRE),
  }),
  'entrada-aceptada': (datos) => ({
    tipo: 'entrada-aceptada',
    conexion: comoIdentificadorDeConexion(campoDeTexto(datos, 'conexion')),
  }),
  'entrada-rechazada': (datos) => ({
    tipo: 'entrada-rechazada',
    causa: unoDe(datos, 'causa', CAUSAS_DE_RECHAZO),
  }),
  'emparejamiento-aceptado': (datos) => ({
    tipo: 'emparejamiento-aceptado',
    conexion: comoIdentificadorDeConexion(campoDeTexto(datos, 'conexion')),
  }),
  'emparejamiento-rechazado': (datos) => ({
    tipo: 'emparejamiento-rechazado',
    causa: unoDe(datos, 'causa', CAUSAS_DE_RECHAZO),
  }),
};

export function interpretarControl(entrada: unknown): Interpretacion {
  if (typeof entrada !== 'string') {
    return { ok: false, causa: 'mensaje-mal-formado', detalle: 'el control viaja como texto' };
  }

  let datos: unknown;
  try {
    datos = JSON.parse(entrada);
  } catch {
    return { ok: false, causa: 'mensaje-mal-formado', detalle: 'no es JSON válido' };
  }

  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, causa: 'mensaje-mal-formado', detalle: 'se esperaba un objeto' };
  }

  const campos = datos as Record<string, unknown>;
  const tipo = campos['tipo'];

  if (typeof tipo !== 'string') {
    return { ok: false, causa: 'mensaje-mal-formado', detalle: 'falta el campo "tipo"' };
  }

  const lector = Object.hasOwn(LECTORES, tipo)
    ? LECTORES[tipo as TipoDeMensaje]
    : undefined;

  if (!lector) {
    return { ok: false, causa: 'mensaje-no-reconocido', detalle: `tipo desconocido: ${tipo}` };
  }

  try {
    return { ok: true, mensaje: lector(campos) };
  } catch (falla) {
    if (falla instanceof Rechazo) {
      return { ok: false, causa: falla.causa, detalle: falla.message };
    }
    return {
      ok: false,
      causa: 'mensaje-mal-formado',
      detalle: falla instanceof Error ? falla.message : 'campo inválido',
    };
  }
}
