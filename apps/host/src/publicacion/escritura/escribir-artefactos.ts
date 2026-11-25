/**
 * Escritura de artefactos de publicación en el working tree (H5 / P6 / H5-T8).
 *
 * Solo bajo D-H5-5 (`harukoia/publicado/…`) respecto a la raíz del checkout
 * (D-H5-4). No es git (P7). No toca documentación manual fuera del prefijo.
 */

import fs from 'node:fs';
import path from 'node:path';

import { PREFIJO_PUBLICADO, comoRutaPublicada, type VinculoSalaRepo } from '@harukoia/domain';

import type { ArtefactoDePublicacion } from '../mecanismo/artefacto-de-publicacion.ts';
import type { ConsumidorDeArtefactos } from '../mecanismo/orquestar-publicacion.ts';

export type CausaDeEscritura =
  | 'sin-artefactos'
  | 'ruta-invalida'
  | 'fuera-del-prefijo'
  | 'fuera-del-checkout'
  | 'artefacto-vacio'
  | 'raiz-invalida';

export type ResultadoDeEscritura =
  | { readonly ok: true; readonly escritas: readonly string[] }
  | { readonly ok: false; readonly causa: CausaDeEscritura; readonly ruta?: string };

type ResolucionDeRuta =
  | { readonly ok: true; readonly relativa: string; readonly absoluta: string }
  | { readonly ok: false; readonly causa: CausaDeEscritura; readonly ruta?: string };

/**
 * Resuelve la ruta absoluta bajo el checkout y comprueba que quede
 * estrictamente dentro de `<raiz>/<PREFIJO_PUBLICADO>/…`.
 */
export function resolverRutaDeEscritura(
  raizDelCheckout: string,
  rutaRelativa: string,
): ResolucionDeRuta {
  const validada = comoRutaPublicada(rutaRelativa);
  if (!validada.ok) {
    return { ok: false, causa: 'ruta-invalida', ruta: String(rutaRelativa) };
  }

  const raiz = path.resolve(raizDelCheckout);
  if (raiz === '' || !fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
    return { ok: false, causa: 'raiz-invalida' };
  }

  const absoluta = path.resolve(raiz, ...validada.relativa.split('/'));
  const prefijoAbsoluto = path.resolve(raiz, ...PREFIJO_PUBLICADO.split('/'));
  const bajoPrefijo =
    absoluta === prefijoAbsoluto || absoluta.startsWith(prefijoAbsoluto + path.sep);
  if (!bajoPrefijo) {
    return { ok: false, causa: 'fuera-del-prefijo', ruta: validada.relativa };
  }

  const bajoCheckout = absoluta === raiz || absoluta.startsWith(raiz + path.sep);
  if (!bajoCheckout) {
    return { ok: false, causa: 'fuera-del-checkout', ruta: validada.relativa };
  }

  return { ok: true, relativa: validada.relativa, absoluta };
}

export function escribirArtefactosEnCheckout(
  raizDelCheckout: string,
  artefactos: readonly ArtefactoDePublicacion[],
): ResultadoDeEscritura {
  if (artefactos.length === 0) {
    return { ok: false, causa: 'sin-artefactos' };
  }

  const escritas: string[] = [];

  for (const artefacto of artefactos) {
    if (artefacto.bytes.byteLength === 0) {
      return { ok: false, causa: 'artefacto-vacio', ruta: artefacto.rutaRelativa };
    }

    const resuelta = resolverRutaDeEscritura(raizDelCheckout, artefacto.rutaRelativa);
    if (!resuelta.ok) {
      return {
        ok: false,
        causa: resuelta.causa,
        ...(resuelta.ruta !== undefined ? { ruta: resuelta.ruta } : {}),
      };
    }

    fs.mkdirSync(path.dirname(resuelta.absoluta), { recursive: true });
    fs.writeFileSync(resuelta.absoluta, artefacto.bytes);
    escritas.push(resuelta.relativa);
  }

  return { ok: true, escritas };
}

/** Consumidor para el orquestador (P4): escribe en la raíz del vínculo sala↔repo. */
export function crearConsumidorQueEscribe(vinculo: VinculoSalaRepo): ConsumidorDeArtefactos {
  return async (artefactos) => {
    const resultado = escribirArtefactosEnCheckout(vinculo.raizDelCheckout, artefactos);
    if (!resultado.ok) {
      const detalle = resultado.ruta !== undefined ? `:${resultado.ruta}` : '';
      return { ok: false, causa: `${resultado.causa}${detalle}` };
    }
    return { ok: true };
  };
}
