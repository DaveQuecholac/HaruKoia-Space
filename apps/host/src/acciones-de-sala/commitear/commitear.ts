/**
 * Acción "commitear" (H4 / V3): staging = toda la pizarra (D-H4-1).
 *
 * Toma snapshot Yjs + JSON del mapa `tablero`, cuelga del tip del historial
 * (o raíz si está vacío) y guarda en `replica.sqlite`. No toca `sala.sqlite`.
 *
 * Participantes = nombres presentes en la presencia al momento (regla V3).
 */

import {
  type IdentificadorDeSala,
  type PedidoDeAccion,
  esRegistroDelDocumentoDelTablero,
  exportarTableroAJson,
  tableroEnJsonVacio,
} from '@harukoia/domain';
import * as Y from 'yjs';

import type { AlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import type { TipDeTrabajo } from '../../versionado/tip-de-trabajo/tip-de-trabajo.ts';
import type { ContextoDeAccion, ManejadorDeAccion, ResultadoDeAccion } from '../acciones-de-sala.ts';

/** Mapa del tablero fijado en H2. */
export const MAPA_DEL_TABLERO = 'tablero';

export type DependenciasDeCommitear = {
  readonly sala: IdentificadorDeSala;
  readonly almacen: AlmacenDeCommits;
  readonly documento: () => Y.Doc;
  /** Tip del estado de trabajo (V5): el nuevo commit cuelga de aquí. */
  readonly tip: TipDeTrabajo;
  /** Nombres en la presencia ahora mismo (snapshot al commitear). */
  readonly nombresPresentes: () => readonly string[];
};

export function commitear(deps: DependenciasDeCommitear): ManejadorDeAccion {
  return async (pedido: PedidoDeAccion, contexto: ContextoDeAccion): Promise<ResultadoDeAccion> => {
    if (pedido.accion !== 'commitear') {
      return { ok: false, causa: 'commit-fallido' };
    }

    const documento = deps.documento();
    const registros = registrosDelTablero(documento);
    const exportado =
      Object.keys(registros).length === 0
        ? { ok: true as const, tablero: tableroEnJsonVacio() }
        : exportarTableroAJson(registros);

    if (!exportado.ok) {
      console.warn(
        JSON.stringify({
          nivel: 'aviso',
          sala: deps.sala,
          accion: 'commitear',
          causa: 'commit-fallido',
          exportacion: exportado.causa,
          id: exportado.id ?? null,
        }),
      );
      return { ok: false, causa: 'commit-fallido' };
    }

    const historial = deps.almacen.listarHistorial(deps.sala);
    const tipActual = deps.tip.leer();
    const padre = tipActual ?? historial.at(-1)?.id ?? null;

    const presentes = deps.nombresPresentes().filter((n) => n.trim() !== '');
    const autor = contexto.autor.trim() !== '' ? contexto.autor.trim() : 'host';
    const participantes = presentes.length > 0 ? presentes : [autor];

    const guardado = deps.almacen.guardar({
      sala: deps.sala,
      padre,
      mensaje: pedido.mensaje,
      autor,
      participantes,
      creadoEn: Date.now(),
      estadoYjs: Y.encodeStateAsUpdate(documento),
      tablero: exportado.tablero,
    });

    if (!guardado.ok) {
      return { ok: false, causa: 'commit-fallido' };
    }

    deps.tip.fijar(guardado.commit.id);

    return {
      ok: true,
      avisos: [
        {
          destino: 'todos',
          mensaje: {
            tipo: 'commit-guardado',
            id: guardado.commit.id,
            mensaje: guardado.commit.mensaje,
            autor: guardado.commit.autor,
            creadoEn: guardado.commit.creadoEn,
            padre: guardado.commit.padre,
          },
        },
      ],
    };
  };
}

function registrosDelTablero(documento: Y.Doc): Record<string, unknown> {
  const mapa = documento.getMap<string>(MAPA_DEL_TABLERO);
  const registros: Record<string, unknown> = {};
  mapa.forEach((valor, clave) => {
    if (typeof valor !== 'string') return;
    try {
      const leido: unknown = JSON.parse(valor);
      if (
        leido !== null &&
        typeof leido === 'object' &&
        !Array.isArray(leido) &&
        (leido as { id?: unknown }).id === clave &&
        typeof (leido as { typeName?: unknown }).typeName === 'string' &&
        esRegistroDelDocumentoDelTablero((leido as { typeName: string }).typeName)
      ) {
        registros[clave] = leido;
      }
    } catch {
      // Registro ilegible: se omite; el export fallará solo si queda vacío de formas útiles.
    }
  });
  return registros;
}
