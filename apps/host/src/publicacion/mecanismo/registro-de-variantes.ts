/**
 * Registro de plugins de variante de formato (H5 / P4).
 * Un solo mapa; sin ramas por nombre de producto.
 */

import type { VarianteDeFormato } from './variante-de-formato.ts';

export type RegistroDeVariantes = {
  registrar(variante: VarianteDeFormato): void;
  obtener(id: string): VarianteDeFormato | undefined;
  ids(): readonly string[];
};

export function crearRegistroDeVariantes(
  iniciales: readonly VarianteDeFormato[] = [],
): RegistroDeVariantes {
  const porId = new Map<string, VarianteDeFormato>();

  const registrar = (variante: VarianteDeFormato): void => {
    if (variante.id.trim() === '') {
      throw new Error('variante sin id');
    }
    if (porId.has(variante.id)) {
      throw new Error(`variante ya registrada: ${variante.id}`);
    }
    porId.set(variante.id, variante);
  };

  for (const v of iniciales) registrar(v);

  return {
    registrar,
    obtener(id) {
      return porId.get(id);
    },
    ids() {
      return [...porId.keys()];
    },
  };
}
