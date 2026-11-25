/**
 * Vínculo sala ↔ repo (D-H5-4): al arrancar el host desde el checkout del proyecto.
 * No es un wizard después de dibujar.
 */

import { comoIdentificadorDeSala, type IdentificadorDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';

export type VinculoSalaRepo = {
  readonly sala: IdentificadorDeSala;
  /**
   * Raíz del working tree (checkout) desde la que se arrancó el host.
   * Cadena no vacía; la existencia en disco la valida quien abre el host (P9).
   */
  readonly raizDelCheckout: string;
};

export type ResultadoDeVinculo =
  | { readonly ok: true; readonly vinculo: VinculoSalaRepo }
  | { readonly ok: false; readonly causa: 'sala-invalida' | 'raiz-vacia' };

export function crearVinculoSalaRepo(datos: {
  readonly sala: IdentificadorDeSala;
  readonly raizDelCheckout: string;
}): ResultadoDeVinculo {
  if (typeof datos.raizDelCheckout !== 'string' || datos.raizDelCheckout.trim() === '') {
    return { ok: false, causa: 'raiz-vacia' };
  }
  return {
    ok: true,
    vinculo: {
      sala: datos.sala,
      raizDelCheckout: datos.raizDelCheckout.trim(),
    },
  };
}

export function comoVinculoSalaRepo(valor: unknown): VinculoSalaRepo {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new TypeError('vínculo sala↔repo inválido');
  }
  const datos = valor as Record<string, unknown>;
  let sala: IdentificadorDeSala;
  try {
    sala = comoIdentificadorDeSala(datos.sala);
  } catch {
    throw new TypeError('vínculo sala↔repo inválido: sala');
  }
  const creado = crearVinculoSalaRepo({
    sala,
    raizDelCheckout: String(datos.raizDelCheckout ?? ''),
  });
  if (!creado.ok) {
    throw new TypeError(`vínculo sala↔repo inválido: ${creado.causa}`);
  }
  return creado.vinculo;
}
