/**
 * Restaura el estado de trabajo desde un snapshot Yjs (H4 / V5).
 *
 * Sustituye el mapa `tablero` (H2) por el del snapshot: no mergea trazos
 * posteriores. El resto del documento Yjs se deja; la pizarra vive en ese mapa.
 */

import * as Y from 'yjs';

/** Mismo nombre que fija H2 / V3. */
export const MAPA_DEL_TABLERO = 'tablero';

export function restaurarEstadoDeTrabajo(documento: Y.Doc, estadoYjs: Uint8Array): void {
  const origen = new Y.Doc();
  Y.applyUpdate(origen, estadoYjs);
  const fuente = origen.getMap<string>(MAPA_DEL_TABLERO);
  const destino = documento.getMap<string>(MAPA_DEL_TABLERO);

  documento.transact(() => {
    for (const clave of [...destino.keys()]) {
      destino.delete(clave);
    }
    fuente.forEach((valor, clave) => {
      destino.set(clave, valor);
    });
  }, 'checkout');

  origen.destroy();
}
