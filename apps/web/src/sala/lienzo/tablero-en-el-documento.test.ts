/**
 * Dos documentos Yjs, sin navegador: un cambio en el store de uno aparece
 * en el store del otro. Es el mismo mapa `tablero` que usa la sala.
 */

import { PageRecordType, createTLStore, type TLPage, type TLPageId, type TLStore } from 'tldraw';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { MAPA_DEL_TABLERO, enlazarTablero } from './tablero-en-el-documento.ts';

function unir(izquierda: Y.Doc, derecha: Y.Doc): void {
  izquierda.on('update', (actualizacion, origen) => {
    if (origen === 'remoto') return;
    Y.applyUpdate(derecha, actualizacion, 'remoto');
  });
  derecha.on('update', (actualizacion, origen) => {
    if (origen === 'remoto') return;
    Y.applyUpdate(izquierda, actualizacion, 'remoto');
  });
}

function ponerPagina(store: TLStore, id: string, nombre: string, index: string): TLPage {
  const pagina = PageRecordType.create({
    id: id as TLPageId,
    name: nombre,
    index: index as TLPage['index'],
  });
  store.put([pagina]);
  return pagina;
}

function pagina(store: TLStore): TLPage {
  const encontrada = Object.values(store.serialize('document')).find((registro) => registro.typeName === 'page');
  if (!encontrada || encontrada.typeName !== 'page') throw new Error('el store no tiene página');
  return encontrada;
}

const CLIENTES = 10;

/**
 * Diez documentos. Mientras está en pausa, cada escritura se queda en su
 * documento: así de verdad coinciden en el tiempo. Al reanudar se mezclan.
 */
function mesa(cantidad: number) {
  const documentos = Array.from({ length: cantidad }, () => new Y.Doc());
  const stores = documentos.map(() => createTLStore());
  let reenviar = true;
  const pendientes: Uint8Array[] = [];

  for (const documento of documentos) {
    documento.on('update', (actualizacion, origen) => {
      if (origen === 'remoto') return;
      if (!reenviar) {
        pendientes.push(actualizacion);
        return;
      }
      for (const otro of documentos) {
        if (otro !== documento) Y.applyUpdate(otro, actualizacion, 'remoto');
      }
    });
  }

  ponerPagina(stores[0]!, 'page:inicio', 'Inicio', 'a0');
  const enlaces = documentos.map((documento, indice) => {
    const enlace = enlazarTablero(stores[indice]!, documento, () => {});
    enlace.editorMontado();
    enlace.alCambiarLaSesion({ sincronizado: true, sembrar: indice === 0 });
    return enlace;
  });

  return {
    stores,
    pausar() {
      reenviar = false;
      pendientes.length = 0;
    },
    reanudar() {
      reenviar = true;
      const lote = pendientes.splice(0);
      for (const actualizacion of lote) {
        for (const documento of documentos) Y.applyUpdate(documento, actualizacion, 'remoto');
      }
    },
    cerrar() {
      for (const enlace of enlaces) enlace.cerrar();
    },
  };
}

function idsDePagina(store: TLStore): string[] {
  return Object.values(store.serialize('document'))
    .filter((registro) => registro.typeName === 'page')
    .map((registro) => registro.id)
    .sort();
}

describe('tablero en el documento', () => {
  it('lleva el nombre de la página de un store al otro', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    unir(docA, docB);
    const storeA = createTLStore();
    const storeB = createTLStore();
    ponerPagina(storeA, 'page:inicio', 'Inicio', 'a1');
    const enlaceA = enlazarTablero(storeA, docA, () => {});
    const enlaceB = enlazarTablero(storeB, docB, () => {});
    enlaceA.editorMontado();
    enlaceB.editorMontado();

    enlaceA.alCambiarLaSesion({ sincronizado: true, sembrar: true });
    enlaceB.alCambiarLaSesion({ sincronizado: true, sembrar: false });

    const actual = pagina(storeA);
    storeA.put([{ ...actual, name: 'Sala' }]);

    expect(pagina(storeB).name).toBe('Sala');
    expect(docB.getMap(MAPA_DEL_TABLERO).size).toBe(Object.keys(storeA.serialize('document')).length);

    enlaceA.cerrar();
    enlaceB.cerrar();
  });

  it('el cambio del segundo vuelve al primero, y borrar también', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    unir(docA, docB);
    const storeA = createTLStore();
    const storeB = createTLStore();
    const primera = ponerPagina(storeA, 'page:inicio', 'Inicio', 'a1');
    const enlaceA = enlazarTablero(storeA, docA, () => {});
    const enlaceB = enlazarTablero(storeB, docB, () => {});
    enlaceA.editorMontado();
    enlaceB.editorMontado();
    enlaceA.alCambiarLaSesion({ sincronizado: true, sembrar: true });
    enlaceB.alCambiarLaSesion({ sincronizado: true, sembrar: false });

    const enB = pagina(storeB);
    storeB.put([{ ...enB, name: 'Invitado' }]);
    expect(storeA.serialize('document')[primera.id]).toMatchObject({ name: 'Invitado' });

    const extra = ponerPagina(storeA, 'page:extra', 'Extra', 'a2');
    expect(storeB.serialize('document')[extra.id]).toMatchObject({ name: 'Extra' });
    storeA.remove([extra.id]);
    expect(storeB.serialize('document')[extra.id]).toBeUndefined();

    enlaceA.cerrar();
    enlaceB.cerrar();
  });

  it('diez clientes escribiendo a la vez conservan el trazo de cada uno y coinciden', () => {
    const sala = mesa(CLIENTES);
    sala.pausar();

    const indices = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'aA'];
    const propios = sala.stores.map((store, indice) => ponerPagina(store, `page:de-${indice}`, `De ${indice}`, indices[indice]!));

    sala.reanudar();

    const esperadas = ['page:inicio', ...propios.map((pagina) => pagina.id)].sort();
    for (const store of sala.stores) {
      expect(idsDePagina(store)).toEqual(esperadas);
    }

    sala.pausar();
    for (const [indice, store] of sala.stores.entries()) {
      const inicio = store.serialize('document')['page:inicio' as TLPageId];
      if (!inicio || inicio.typeName !== 'page') throw new Error('falta la página compartida');
      store.put([{ ...inicio, name: `nombre-${indice}` }]);
    }
    sala.reanudar();

    const nombres = sala.stores.map((store) => {
      const inicio = store.serialize('document')['page:inicio' as TLPageId];
      if (!inicio || inicio.typeName !== 'page') throw new Error('falta la página compartida');
      return inicio.name;
    });
    expect(new Set(nombres).size).toBe(1);
    for (const store of sala.stores) expect(idsDePagina(store)).toEqual(esperadas);

    sala.cerrar();
  });

  it('sin red enseña el tablero que ya estaba y guarda el trazo nuevo', () => {
    const documento = new Y.Doc();
    const guardada = PageRecordType.create({
      id: 'page:inicio' as TLPageId,
      name: 'Inicio',
      index: 'a0' as TLPage['index'],
    });
    documento.getMap<string>(MAPA_DEL_TABLERO).set(guardada.id, JSON.stringify(guardada));

    const store = createTLStore();
    const enlace = enlazarTablero(store, documento, () => {});
    enlace.editorMontado();
    enlace.alCambiarLaSesion({ sincronizado: false, sembrar: false });

    expect(pagina(store).name).toBe('Inicio');
    ponerPagina(store, 'page:fuera', 'Fuera', 'a1');
    expect(documento.getMap<string>(MAPA_DEL_TABLERO).has('page:fuera')).toBe(true);

    const otro = new Y.Doc();
    const storeDelOtro = createTLStore();
    const enlaceDelOtro = enlazarTablero(storeDelOtro, otro, () => {});
    enlaceDelOtro.editorMontado();
    enlaceDelOtro.alCambiarLaSesion({ sincronizado: true, sembrar: false });
    Y.applyUpdate(otro, Y.encodeStateAsUpdate(documento, Y.encodeStateVector(otro)), 'remoto');

    expect(idsDePagina(storeDelOtro)).toEqual(['page:fuera', 'page:inicio']);
    enlace.cerrar();
    enlaceDelOtro.cerrar();
  });
});
