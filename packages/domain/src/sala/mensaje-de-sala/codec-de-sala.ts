/**
 * Serialización de los mensajes de sala. Fijado en el paso B8, con la misma
 * forma que el codec de control: texto JSON y un lector por tipo.
 *
 * Lo que llega de un participante no es de fiar: se valida campo por campo y
 * cualquier cosa fuera del contrato se devuelve como ilegible, con detalle.
 */

import { ACCIONES_DE_SALA, CAUSAS_DE_ACCION_RECHAZADA } from '../accion-de-sala/accion-de-sala.ts';
import { comoTokenDeInvitacion } from '../identidad-de-sala/identidad-de-sala.ts';
import { ROLES } from '../rol/rol.ts';
import type { MensajeDeSala, TipoDeMensajeDeSala } from './mensaje-de-sala.ts';

export type InterpretacionDeSala =
  | { readonly ok: true; readonly mensaje: MensajeDeSala }
  | { readonly ok: false; readonly detalle: string };

export function serializarMensajeDeSala(mensaje: MensajeDeSala): string {
  return JSON.stringify(mensaje);
}

function unoDe<T extends string>(datos: Record<string, unknown>, clave: string, permitidos: readonly T[]): T {
  const valor = datos[clave];
  if (typeof valor !== 'string' || !(permitidos as readonly string[]).includes(valor)) {
    throw new Error(`"${clave}" no es un valor reconocido`);
  }
  return valor as T;
}

const LECTORES: Record<TipoDeMensajeDeSala, (datos: Record<string, unknown>) => MensajeDeSala> = {
  'pedir-accion': (datos) => ({ tipo: 'pedir-accion', accion: unoDe(datos, 'accion', ACCIONES_DE_SALA) }),
  'tu-rol': (datos) => ({ tipo: 'tu-rol', rol: unoDe(datos, 'rol', ROLES) }),
  'accion-rechazada': (datos) => ({
    tipo: 'accion-rechazada',
    accion: unoDe(datos, 'accion', ACCIONES_DE_SALA),
    causa: unoDe(datos, 'causa', CAUSAS_DE_ACCION_RECHAZADA),
  }),
  'invitacion-cambiada': (datos) => ({
    tipo: 'invitacion-cambiada',
    tokenDeInvitacion: comoTokenDeInvitacion(datos['tokenDeInvitacion']),
  }),
};

export function interpretarMensajeDeSala(texto: string): InterpretacionDeSala {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, detalle: 'no es JSON válido' };
  }
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, detalle: 'se esperaba un objeto' };
  }

  const campos = datos as Record<string, unknown>;
  const tipo = campos['tipo'];
  const lector =
    typeof tipo === 'string' && Object.hasOwn(LECTORES, tipo) ? LECTORES[tipo as TipoDeMensajeDeSala] : undefined;
  if (!lector) return { ok: false, detalle: `tipo desconocido: ${String(tipo)}` };

  try {
    return { ok: true, mensaje: lector(campos) };
  } catch (falla) {
    return { ok: false, detalle: falla instanceof Error ? falla.message : 'campo inválido' };
  }
}
