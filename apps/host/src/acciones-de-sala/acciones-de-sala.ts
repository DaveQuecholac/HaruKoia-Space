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

export type ManejadorDeAccion = () => Promise<ResultadoDeAccion>;

/** Un manejador por acción. `Record` para que una acción nueva no compile sin el suyo. */
export type ManejadoresDeAccion = Readonly<Record<AccionDeSala, ManejadorDeAccion>>;

export async function atenderAccion(
  accion: AccionDeSala,
  rol: Rol,
  manejadores: ManejadoresDeAccion,
): Promise<ResultadoDeAccion> {
  if (!puedePedir(rol, accion)) return { ok: false, causa: 'rol-insuficiente' };
  return manejadores[accion]();
}
