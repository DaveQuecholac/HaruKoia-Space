/**
 * Log local del documento de la sala. Vive en IndexedDB del navegador.
 *
 * No es el disco del host. Al volver a la misma sala, Yjs carga este log y
 * lo fusiona con lo que tenga el host. Salir cierra la base y no la borra.
 */

import { IndexeddbPersistence } from 'y-indexeddb';
import type * as Y from 'yjs';

export type LogLocal = {
  cerrar(): void;
};

export function abrirLogLocal(sala: string, documento: Y.Doc, alNoPoder: () => void): LogLocal {
  if (typeof indexedDB === 'undefined') {
    alNoPoder();
    return { cerrar() {} };
  }
  try {
    const persistencia = new IndexeddbPersistence(sala, documento);
    return {
      cerrar() {
        void persistencia.destroy();
      },
    };
  } catch {
    alNoPoder();
    return { cerrar() {} };
  }
}
