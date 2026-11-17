/**
 * Tip del estado de trabajo (H4 / V5).
 *
 * El siguiente commit cuelga de este id. Checkout lo mueve; un commit nuevo
 * lo avanza. No reescribe el historial. En memoria del proceso host.
 */

import type { IdentificadorDeCommit } from '@harukoia/domain';

export type TipDeTrabajo = {
  leer(): IdentificadorDeCommit | null;
  fijar(id: IdentificadorDeCommit): void;
};

export function crearTipDeTrabajo(inicial: IdentificadorDeCommit | null = null): TipDeTrabajo {
  let tip: IdentificadorDeCommit | null = inicial;
  return {
    leer() {
      return tip;
    },
    fijar(id) {
      tip = id;
    },
  };
}
