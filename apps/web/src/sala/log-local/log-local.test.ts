/**
 * El log de la sala queda en IndexedDB. Un documento nuevo de la misma sala
 * lo recupera, y lo dibujado en otro cliente se fusiona sin pisar lo local.
 */

import 'fake-indexeddb/auto';

import { IndexeddbPersistence } from 'y-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

const SALA = 'sala-log-local';

async function hastaSincronizar(persistencia: IndexeddbPersistence): Promise<void> {
  await persistencia.whenSynced;
}

afterEach(async () => {
  await new Promise<void>((listo, fallar) => {
    const pedido = indexedDB.deleteDatabase(SALA);
    pedido.onsuccess = () => listo();
    pedido.onerror = () => fallar(pedido.error ?? new Error('no se pudo borrar el log'));
  });
});

describe('log local de la sala', () => {
  it('recupera el trazo hecho sin red y lo fusiona con el del otro', async () => {
    const local = new Y.Doc();
    const primero = new IndexeddbPersistence(SALA, local);
    await hastaSincronizar(primero);
    local.getMap<string>('tablero').set('shape:mio', 'trazo-local');
    await new Promise((listo) => setTimeout(listo, 30));
    await primero.destroy();
    local.destroy();

    const vuelto = new Y.Doc();
    const segundo = new IndexeddbPersistence(SALA, vuelto);
    await hastaSincronizar(segundo);

    const remoto = new Y.Doc();
    remoto.getMap<string>('tablero').set('shape:suyo', 'trazo-ajeno');
    Y.applyUpdate(vuelto, Y.encodeStateAsUpdate(remoto));
    Y.applyUpdate(remoto, Y.encodeStateAsUpdate(vuelto));

    expect(vuelto.getMap<string>('tablero').get('shape:mio')).toBe('trazo-local');
    expect(vuelto.getMap<string>('tablero').get('shape:suyo')).toBe('trazo-ajeno');
    expect(remoto.getMap<string>('tablero').get('shape:mio')).toBe('trazo-local');
    expect(remoto.getMap<string>('tablero').get('shape:suyo')).toBe('trazo-ajeno');

    await segundo.destroy();
    vuelto.destroy();
    remoto.destroy();
  });
});
