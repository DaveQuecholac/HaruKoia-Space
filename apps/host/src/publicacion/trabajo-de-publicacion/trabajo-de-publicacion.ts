/**
 * Trabajo de la cola de publicación (H5 / P3).
 *
 * Ligado a un commit de pizarra. El estado del job es el de la cola en disco;
 * el `EstadoDePush` del documento en réplica se cablea en P8.
 */

import {
  comoIdentificadorDeCommit,
  esVarianteDePublicacion,
  type IdentificadorDeCommit,
  type VarianteDePublicacion,
} from '@harukoia/domain';
import { randomBytes } from 'node:crypto';

export const ESTADOS_DE_TRABAJO = ['pendiente', 'en-proceso', 'publicado', 'fallido'] as const;

export type EstadoDeTrabajoDePublicacion = (typeof ESTADOS_DE_TRABAJO)[number];

export type TrabajoDePublicacion = {
  readonly id: string;
  readonly commit: IdentificadorDeCommit;
  readonly variante: VarianteDePublicacion;
  readonly estado: EstadoDeTrabajoDePublicacion;
  /** Intentos de proceso completados o interrumpidos. */
  readonly intentos: number;
  readonly creadoEn: number;
  readonly actualizadoEn: number;
  readonly causa?: string;
};

export type DatosParaCrearTrabajo = {
  readonly commit: IdentificadorDeCommit;
  readonly variante?: VarianteDePublicacion;
  readonly creadoEn: number;
  readonly id?: string;
};

export function generarIdentificadorDeTrabajo(): string {
  return `pubjob_${randomBytes(8).toString('hex')}`;
}

export function crearTrabajoDePublicacion(datos: DatosParaCrearTrabajo): TrabajoDePublicacion {
  const variante = datos.variante ?? 'markdown-determinista';
  if (!esVarianteDePublicacion(variante)) {
    throw new TypeError('variante de publicación inválida');
  }
  const ahora = datos.creadoEn;
  return {
    id: datos.id ?? generarIdentificadorDeTrabajo(),
    commit: datos.commit,
    variante,
    estado: 'pendiente',
    intentos: 0,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

export function comoTrabajoDePublicacion(valor: unknown): TrabajoDePublicacion {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new TypeError('trabajo de publicación inválido');
  }
  const datos = valor as Record<string, unknown>;
  if (typeof datos.id !== 'string' || datos.id.trim() === '') {
    throw new TypeError('trabajo de publicación inválido: id');
  }
  if (
    typeof datos.estado !== 'string' ||
    !(ESTADOS_DE_TRABAJO as readonly string[]).includes(datos.estado)
  ) {
    throw new TypeError('trabajo de publicación inválido: estado');
  }
  if (!esVarianteDePublicacion(datos.variante)) {
    throw new TypeError('trabajo de publicación inválido: variante');
  }
  if (!Number.isFinite(datos.intentos) || (datos.intentos as number) < 0) {
    throw new TypeError('trabajo de publicación inválido: intentos');
  }
  if (!Number.isFinite(datos.creadoEn) || (datos.creadoEn as number) < 0) {
    throw new TypeError('trabajo de publicación inválido: creadoEn');
  }
  if (!Number.isFinite(datos.actualizadoEn) || (datos.actualizadoEn as number) < 0) {
    throw new TypeError('trabajo de publicación inválido: actualizadoEn');
  }

  const trabajo: TrabajoDePublicacion = {
    id: datos.id,
    commit: comoIdentificadorDeCommit(datos.commit),
    variante: datos.variante,
    estado: datos.estado as EstadoDeTrabajoDePublicacion,
    intentos: datos.intentos as number,
    creadoEn: datos.creadoEn as number,
    actualizadoEn: datos.actualizadoEn as number,
  };

  if (datos.causa !== undefined) {
    if (typeof datos.causa !== 'string' || datos.causa.trim() === '') {
      throw new TypeError('trabajo de publicación inválido: causa');
    }
    return { ...trabajo, causa: datos.causa.trim() };
  }
  return trabajo;
}
