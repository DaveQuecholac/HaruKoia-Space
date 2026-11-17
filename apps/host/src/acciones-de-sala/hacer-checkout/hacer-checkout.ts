/**
 * Acción "hacer-checkout" (H4 / V5): estado de trabajo = snapshot del commit.
 * El tip pasa a ese id; el historial no se reescribe (análisis §7).
 */

import {
  type IdentificadorDeCommit,
  type IdentificadorDeSala,
  type PedidoDeAccion,
  comoIdentificadorDeCommit,
} from '@harukoia/domain';
import type * as Y from 'yjs';

import type { AlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { restaurarEstadoDeTrabajo } from '../../versionado/restaurar-estado-de-trabajo/restaurar-estado-de-trabajo.ts';
import type { TipDeTrabajo } from '../../versionado/tip-de-trabajo/tip-de-trabajo.ts';
import type { ContextoDeAccion, ManejadorDeAccion, ResultadoDeAccion } from '../acciones-de-sala.ts';

export type DependenciasDeCheckout = {
  readonly sala: IdentificadorDeSala;
  readonly almacen: AlmacenDeCommits;
  readonly documento: () => Y.Doc;
  readonly tip: TipDeTrabajo;
};

export function hacerCheckout(deps: DependenciasDeCheckout): ManejadorDeAccion {
  return async (pedido: PedidoDeAccion, _contexto: ContextoDeAccion): Promise<ResultadoDeAccion> => {
    if (pedido.accion !== 'hacer-checkout') {
      return { ok: false, causa: 'checkout-fallido' };
    }

    let id: IdentificadorDeCommit;
    try {
      id = comoIdentificadorDeCommit(pedido.id);
    } catch {
      return { ok: false, causa: 'commit-inexistente' };
    }

    const enSala = deps.almacen.listarHistorial(deps.sala).some((c) => c.id === id);
    if (!enSala) {
      return { ok: false, causa: 'commit-inexistente' };
    }

    const snap = deps.almacen.leerSnapshot(id);
    if (!snap) {
      return { ok: false, causa: 'checkout-fallido' };
    }

    try {
      restaurarEstadoDeTrabajo(deps.documento(), snap.estadoYjs);
    } catch {
      return { ok: false, causa: 'checkout-fallido' };
    }

    deps.tip.fijar(id);

    return {
      ok: true,
      avisos: [
        {
          destino: 'todos',
          mensaje: { tipo: 'checkout-hecho', id },
        },
      ],
    };
  };
}
