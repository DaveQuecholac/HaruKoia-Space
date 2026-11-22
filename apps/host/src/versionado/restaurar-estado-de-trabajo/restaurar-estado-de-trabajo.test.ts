import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { MAPA_DEL_TABLERO, restaurarEstadoDeTrabajo } from './restaurar-estado-de-trabajo.ts';

describe('restaurar estado de trabajo', () => {
  it('deja el tablero igual al del snapshot y quita lo posterior', () => {
    const enA = new Y.Doc();
    enA.getMap<string>(MAPA_DEL_TABLERO).set(
      'shape:a',
      JSON.stringify({ id: 'shape:a', typeName: 'shape', type: 'draw' }),
    );
    const snapshotA = Y.encodeStateAsUpdate(enA);

    const vivo = new Y.Doc();
    Y.applyUpdate(vivo, snapshotA);
    vivo.getMap<string>(MAPA_DEL_TABLERO).set(
      'shape:b',
      JSON.stringify({ id: 'shape:b', typeName: 'shape', type: 'draw' }),
    );

    restaurarEstadoDeTrabajo(vivo, snapshotA);

    const mapa = vivo.getMap<string>(MAPA_DEL_TABLERO);
    expect([...mapa.keys()].sort()).toEqual(['shape:a']);
    expect(mapa.get('shape:a')).toContain('shape:a');
  });
});
