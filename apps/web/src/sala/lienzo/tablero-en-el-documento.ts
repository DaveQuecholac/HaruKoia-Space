/**
 * Tablero de la sala dentro del documento Yjs que ya abre la conexión.
 *
 * Un `Y.Map` llamado `tablero`. Cada entrada es el id de un registro del
 * documento de tldraw y el valor es ese registro en JSON. Va en texto para
 * que Yjs no lo convierta en otro mapa. La cámara y la presencia no entran:
 * la presencia sigue en awareness.
 *
 * El store escucha solo cambios locales del documento (`source: 'user'`,
 * `scope: 'document'`). Lo que llega de otro cliente se aplica con
 * `mergeRemoteChanges`, así no rebota.
 */

import { type TLRecord, type TLStore } from 'tldraw';
import * as Y from 'yjs';

export const MAPA_DEL_TABLERO = 'tablero';

const ORIGEN_LOCAL = 'tablero-local';

export type SesionDelTablero = {
  readonly sincronizado: boolean;
  /** Solo el host escribe el tablero cuando el mapa todavía está vacío. */
  readonly sembrar: boolean;
};

export type EnlaceDelTablero = {
  alCambiarLaSesion(sesion: SesionDelTablero): void;
  /** El editor ya creó la página inicial. Sin eso el store todavía no tiene tablero. */
  editorMontado(): void;
  cerrar(): void;
};

export function enlazarTablero(store: TLStore, documento: Y.Doc, alEstarListo: () => void): EnlaceDelTablero {
  const mapa = documento.getMap<string>(MAPA_DEL_TABLERO);
  let sincronizado = false;
  let sembrar = false;
  let aplicado = false;
  let editorListo = false;
  let dejarDePublicar = (): void => {};

  function registrosLocales(): Record<string, TLRecord> {
    return store.serialize('document');
  }

  function sembrarDesdeElStore(): void {
    const registros = registrosLocales();
    documento.transact(() => {
      for (const registro of Object.values(registros)) {
        mapa.set(registro.id, JSON.stringify(registro));
      }
    }, ORIGEN_LOCAL);
  }

  function cargarDesdeElMapa(): void {
    const remotos = leerMapa(mapa);
    const actual = store.getStoreSnapshot('document');
    store.mergeRemoteChanges(() => {
      store.loadStoreSnapshot({ schema: actual.schema, store: remotos });
    });
  }

  function publicarCambios(): void {
    dejarDePublicar = store.listen(
      (entrada) => {
        documento.transact(() => {
          for (const registro of Object.values(entrada.changes.added)) {
            mapa.set(registro.id, JSON.stringify(registro));
          }
          for (const [, registro] of Object.values(entrada.changes.updated)) {
            mapa.set(registro.id, JSON.stringify(registro));
          }
          for (const registro of Object.values(entrada.changes.removed)) {
            mapa.delete(registro.id);
          }
        }, ORIGEN_LOCAL);
      },
      { source: 'user', scope: 'document' },
    );
  }

  function intentarCargaInicial(): void {
    if (aplicado || !editorListo) return;
    // El log local puede traer el tablero antes de que vuelva la red.
    // Sembrar el vacío sigue esperando al host ya sincronizado.
    if (mapa.size === 0) {
      if (!sincronizado || !sembrar) return;
      if (Object.keys(registrosLocales()).length === 0) return;
      sembrarDesdeElStore();
    } else {
      cargarDesdeElMapa();
    }
    aplicado = true;
    publicarCambios();
    alEstarListo();
  }

  function alCambiarElMapa(evento: Y.YMapEvent<string>): void {
    if (evento.transaction.origin === ORIGEN_LOCAL) return;
    if (!aplicado) {
      intentarCargaInicial();
      return;
    }
    store.mergeRemoteChanges(() => {
      evento.changes.keys.forEach((cambio, clave) => {
        if (cambio.action === 'delete') {
          store.remove([clave as TLRecord['id']]);
          return;
        }
        const registro = leerRegistro(mapa.get(clave), clave);
        if (registro) store.put([registro]);
      });
    });
  }

  mapa.observe(alCambiarElMapa);

  return {
    alCambiarLaSesion(sesion) {
      sincronizado = sesion.sincronizado;
      sembrar = sesion.sembrar;
      intentarCargaInicial();
    },
    editorMontado() {
      editorListo = true;
      intentarCargaInicial();
    },
    cerrar() {
      dejarDePublicar();
      mapa.unobserve(alCambiarElMapa);
    },
  };
}

function leerMapa(mapa: Y.Map<string>): Record<string, TLRecord> {
  const registros: Record<string, TLRecord> = {};
  mapa.forEach((valor, clave) => {
    const registro = leerRegistro(valor, clave);
    if (registro) registros[clave] = registro;
  });
  return registros;
}

function leerRegistro(valor: unknown, id: string): TLRecord | undefined {
  if (typeof valor !== 'string') return undefined;
  let leido: unknown;
  try {
    leido = JSON.parse(valor);
  } catch {
    return undefined;
  }
  if (typeof leido !== 'object' || leido === null) return undefined;
  if (!('id' in leido) || leido.id !== id) return undefined;
  if (!('typeName' in leido) || typeof leido.typeName !== 'string') return undefined;
  return leido as TLRecord;
}
