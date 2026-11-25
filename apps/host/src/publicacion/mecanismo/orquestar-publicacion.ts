/**
 * Orquestación genérica: resuelve la variante del trabajo y la invoca (H5 / P4).
 * Devuelve un `ProcesadorDePublicacion` para la cola (P3).
 *
 * No escribe disco ni git. No nombra variantes de producto.
 */

import { comoRutaPublicada } from '@harukoia/domain';

import type { ProcesadorDePublicacion } from '../cola-de-publicacion/cola-de-publicacion.ts';
import type { TrabajoDePublicacion } from '../trabajo-de-publicacion/trabajo-de-publicacion.ts';
import type { ArtefactoDePublicacion } from './artefacto-de-publicacion.ts';
import type { RegistroDeVariantes } from './registro-de-variantes.ts';
import type { EntradaDePublicacion } from './variante-de-formato.ts';

export type CargadorDeEntrada = (
  trabajo: TrabajoDePublicacion,
) => Promise<
  | { readonly ok: true; readonly entrada: EntradaDePublicacion }
  | { readonly ok: false; readonly causa: string }
>;

export type ConsumidorDeArtefactos = (
  artefactos: readonly ArtefactoDePublicacion[],
) => Promise<{ readonly ok: true } | { readonly ok: false; readonly causa: string }>;

/**
 * Por defecto (P4): valida artefactos en memoria y no escribe.
 * P6 inyectará un consumidor que escriba al working tree.
 */
export const consumidorSoloValidar: ConsumidorDeArtefactos = async (artefactos) => {
  if (artefactos.length === 0) {
    return { ok: false, causa: 'sin-artefactos' };
  }
  for (const a of artefactos) {
    const ruta = comoRutaPublicada(a.rutaRelativa);
    if (!ruta.ok) return { ok: false, causa: `ruta-invalida:${a.rutaRelativa}` };
    if (a.bytes.byteLength === 0) return { ok: false, causa: 'artefacto-vacio' };
  }
  return { ok: true };
};

export function crearProcesadorDesdeRegistro(
  registro: RegistroDeVariantes,
  cargarEntrada: CargadorDeEntrada,
  consumir: ConsumidorDeArtefactos = consumidorSoloValidar,
): ProcesadorDePublicacion {
  return async (trabajo) => {
    const variante = registro.obtener(trabajo.variante);
    if (variante === undefined) {
      return { ok: false, causa: `variante-no-registrada:${trabajo.variante}` };
    }

    const cargada = await cargarEntrada(trabajo);
    if (!cargada.ok) return { ok: false, causa: cargada.causa };

    let producida;
    try {
      producida = await variante.producir({
        trabajo,
        entrada: cargada.entrada,
      });
    } catch (error) {
      const causa =
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'variante-lanzo';
      return { ok: false, causa };
    }

    if (!producida.ok) return { ok: false, causa: producida.causa };

    const destino = await consumir(producida.artefactos);
    if (!destino.ok) return { ok: false, causa: destino.causa };
    return { ok: true };
  };
}
