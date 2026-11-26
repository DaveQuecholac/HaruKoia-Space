/**
 * Acciones de sala en el host. Fijado en el paso B8.
 *
 * Este archivo es el mecanismo: valida que el rol de la conexión alcance para
 * la acción y, solo entonces, llama a su manejador. No sabe qué hace ninguna
 * acción. Una acción nueva es su manejador en una carpeta propia, junto a
 * esta, y su entrada en `ManejadoresDeAccion`.
 */

import {
  type AccionDeSala,
  type CausaDeAccionRechazada,
  type MensajeDelHostDeLaSala,
  type PedidoDeAccion,
  type Rol,
  puedePedir,
} from '@harukoia/domain';

/** A quién le llega un aviso que deja una acción aceptada. */
export type DestinoDelAviso = 'hosts' | 'todos';

export type ResultadoDeAccion =
  | {
      readonly ok: true;
      readonly avisos: readonly { readonly destino: DestinoDelAviso; readonly mensaje: MensajeDelHostDeLaSala }[];
    }
  | { readonly ok: false; readonly causa: CausaDeAccionRechazada };

/** Quién pidió la acción (nombre de presencia al momento). */
export type ContextoDeAccion = {
  readonly autor: string;
  /**
   * Aviso en vivo durante una acción larga (H5 / P8: estados de push).
   * El host de la sala lo cablea a todas las conexiones.
   */
  readonly avisar: (mensaje: MensajeDelHostDeLaSala) => void;
};

export type ManejadorDeAccion = (
  pedido: PedidoDeAccion,
  contexto: ContextoDeAccion,
) => Promise<ResultadoDeAccion>;

/** Un manejador por acción. `Record` para que una acción nueva no compile sin el suyo. */
export type ManejadoresDeAccion = Readonly<Record<AccionDeSala, ManejadorDeAccion>>;

export async function atenderAccion(
  pedido: PedidoDeAccion,
  rol: Rol,
  manejadores: ManejadoresDeAccion,
  contexto: ContextoDeAccion,
): Promise<ResultadoDeAccion> {
  if (!puedePedir(rol, pedido.accion)) return { ok: false, causa: 'rol-insuficiente' };
  return manejadores[pedido.accion](pedido, contexto);
}
