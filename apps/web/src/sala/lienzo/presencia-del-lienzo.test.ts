/**
 * La presencia del lienzo sale del awareness y entra al store.
 * Sin nombre no hay cursor. Al desaparecer el estado, desaparece el registro.
 */

import { InstancePresenceRecordType, createTLStore, type TLInstancePresence } from 'tldraw';
import { describe, expect, it } from 'vitest';

import { aplicarPresencias, leerPresenciasAjenas } from './presencia-del-lienzo.ts';

function estados(): Map<number, Record<string, unknown>> {
  return new Map<number, Record<string, unknown>>([
    [1, { nombre: 'Ana', cursor: { x: 1, y: 2 }, seleccion: ['shape:mia'], pagina: 'page:inicio' }],
    [
      2,
      { nombre: 'Bea', cursor: { x: 8, y: 9 }, seleccion: ['shape:suya', 'no-es-forma'], pagina: 'page:inicio' },
    ],
    [3, { nombre: '   ', cursor: { x: 0, y: 0 }, pagina: 'page:inicio' }],
    [4, { cursor: { x: 4, y: 4 }, pagina: 'page:inicio' }],
    [5, { nombre: 'Sin página', cursor: { x: 1, y: 1 } }],
  ]);
}

describe('presencia del lienzo', () => {
  it('deja fuera al propio, al anónimo y a quien no dice su página', () => {
    const ajenas = leerPresenciasAjenas(estados(), 1);
    expect(ajenas.map((ajena) => ajena.nombre)).toEqual(['Bea']);
    expect(ajenas[0]).toMatchObject({
      cliente: 2,
      cursor: { x: 8, y: 9 },
      seleccion: ['shape:suya'],
      pagina: 'page:inicio',
    });
  });

  it('un cursor mal formado no inventa un punto', () => {
    const ajenas = leerPresenciasAjenas(
      new Map([[2, { nombre: 'Bea', cursor: { x: 'no', y: 1 }, pagina: 'page:inicio' }]]),
      1,
    );
    expect(ajenas[0]?.cursor).toBeNull();
  });

  it('pinta el nombre y lo quita cuando esa persona ya no está', () => {
    const store = createTLStore();
    const puestas = new Set<TLInstancePresence['id']>();
    const id = InstancePresenceRecordType.createId('2');

    aplicarPresencias(store, leerPresenciasAjenas(estados(), 1), puestas);
    expect(store.get(id)?.userName).toBe('Bea');

    aplicarPresencias(store, [], puestas);
    expect(store.get(id)).toBeUndefined();
  });
});
