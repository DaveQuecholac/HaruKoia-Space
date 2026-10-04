/**
 * Acciones de sala: lo que un participante le pide al host. Fijado en el
 * paso B8.
 *
 * El host decide si la ejecuta según el rol de la **conexión** que la pidió,
 * no según nada que diga el mensaje. Una acción nueva (staging, commit, push)
 * es un miembro de `ACCIONES_DE_SALA` y su fila en `ROL_QUE_EXIGE`: el
 * `Record` no compila sin decidir quién puede pedirla.
 */

import type { Rol } from '../rol/rol.ts';

export const ACCIONES_DE_SALA = ['cambiar-invitacion'] as const;

export type AccionDeSala = (typeof ACCIONES_DE_SALA)[number];

const ROL_QUE_EXIGE: Readonly<Record<AccionDeSala, Rol>> = {
  'cambiar-invitacion': 'host',
};

/** Un host puede todo lo de un espectador; un espectador, solo lo suyo. */
export function puedePedir(rol: Rol, accion: AccionDeSala): boolean {
  return ROL_QUE_EXIGE[accion] === 'espectador' || rol === 'host';
}

/** Por qué el host no ejecutó una acción. Siempre con causa. */
export const CAUSAS_DE_ACCION_RECHAZADA = ['rol-insuficiente', 'orquestador-no-disponible'] as const;

export type CausaDeAccionRechazada = (typeof CAUSAS_DE_ACCION_RECHAZADA)[number];
