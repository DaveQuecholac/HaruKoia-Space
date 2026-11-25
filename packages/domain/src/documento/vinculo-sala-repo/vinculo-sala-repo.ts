/**
 * Vínculo sala ↔ repo (D-H5-4): al arrancar el host dentro del checkout del proyecto.
 * No es un wizard después de dibujar.
 *
 * `raizDelCheckout` es la **raíz del repositorio git** (`git rev-parse --show-toplevel`),
 * no el cwd del proceso host si este corre en un subdirectorio (p. ej. `apps/host`).
 * Ahí se escriben `Harukoia/Pizarra/…` y `Harukoia/documentos/…`.
 */

import { comoIdentificadorDeSala, type IdentificadorDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';

export type VinculoSalaRepo = {
  readonly sala: IdentificadorDeSala;
  /**
   * Raíz del working tree git del proyecto (toplevel).
   * Cadena no vacía; quien abre el host la resuelve con git.
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
