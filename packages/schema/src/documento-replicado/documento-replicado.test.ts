import { describe, expect, it } from 'vitest';

import {
  type Checkpoint,
  compararOrdenDeReplica,
  esPosteriorAlCheckpoint,
  traerDesdeCheckpoint,
} from './documento-replicado.ts';

const documento = (actualizadoEn: number, id: string) => ({ actualizadoEn, id });

describe('orden de réplica', () => {
  it('ordena por la marca del host', () => {
    expect(compararOrdenDeReplica(documento(1, 'b'), documento(2, 'a'))).toBeLessThan(0);
    expect(compararOrdenDeReplica(documento(3, 'a'), documento(2, 'z'))).toBeGreaterThan(0);
  });

  it('desempata por identificador cuando la marca es la misma', () => {
    expect(compararOrdenDeReplica(documento(5, 'aaa'), documento(5, 'bbb'))).toBeLessThan(0);
    expect(compararOrdenDeReplica(documento(5, 'bbb'), documento(5, 'aaa'))).toBeGreaterThan(0);
    expect(compararOrdenDeReplica(documento(5, 'igual'), documento(5, 'igual'))).toBe(0);
  });

  it('da un orden total: ordenar dos veces no cambia el resultado', () => {
    const documentos = [
      documento(2, 'b'),
      documento(1, 'z'),
      documento(2, 'a'),
      documento(1, 'a'),
    ];

    const unaVez = [...documentos].sort(compararOrdenDeReplica);
    const dosVeces = [...unaVez].sort(compararOrdenDeReplica);

    expect(dosVeces).toEqual(unaVez);
    expect(unaVez.map((d) => d.id)).toEqual(['a', 'z', 'a', 'b']);
  });
});

describe('avance desde un checkpoint', () => {
  const todos = [
    documento(1, 'uno'),
    documento(2, 'dos'),
    documento(2, 'tres'),
    documento(3, 'cuatro'),
  ];

  it('sin checkpoint trae desde el principio', () => {
    const { documentos } = traerDesdeCheckpoint(todos, null, 10);

    expect(documentos.map((d) => d.id)).toEqual(['uno', 'dos', 'tres', 'cuatro']);
  });

  it('no repite lo que el cliente ya tiene', () => {
    const checkpoint: Checkpoint = { actualizadoEn: 2, id: 'dos' };

    const { documentos } = traerDesdeCheckpoint(todos, checkpoint, 10);

    expect(documentos.map((d) => d.id)).toEqual(['tres', 'cuatro']);
  });

  it('no pierde documentos escritos en el mismo milisegundo al paginar', () => {
    // El caso que el desempate por identificador existe para evitar.
    const primeraPagina = traerDesdeCheckpoint(todos, null, 2);
    const segundaPagina = traerDesdeCheckpoint(todos, primeraPagina.checkpoint, 2);

    const traidos = [...primeraPagina.documentos, ...segundaPagina.documentos];

    expect(traidos.map((d) => d.id)).toEqual(['uno', 'dos', 'tres', 'cuatro']);
  });

  it('devuelve el checkpoint anterior cuando ya no hay nada nuevo', () => {
    const checkpoint: Checkpoint = { actualizadoEn: 3, id: 'cuatro' };

    const resultado = traerDesdeCheckpoint(todos, checkpoint, 10);

    expect(resultado.documentos).toEqual([]);
    expect(resultado.checkpoint).toEqual(checkpoint);
  });

  it('un documento borrado viaja como cualquier otro', () => {
    const conBorrado = [...todos, { actualizadoEn: 4, id: 'cinco', borrado: true }];

    const { documentos } = traerDesdeCheckpoint(conBorrado, { actualizadoEn: 3, id: 'cuatro' }, 10);

    expect(documentos).toEqual([{ actualizadoEn: 4, id: 'cinco', borrado: true }]);
  });

  it('exige un límite válido', () => {
    expect(() => traerDesdeCheckpoint(todos, null, 0)).toThrow(RangeError);
    expect(() => traerDesdeCheckpoint(todos, null, -1)).toThrow(RangeError);
  });

  it('respeta el límite', () => {
    expect(traerDesdeCheckpoint(todos, null, 1).documentos).toHaveLength(1);
    expect(traerDesdeCheckpoint(todos, null, 3).documentos).toHaveLength(3);
  });
});

describe('esPosteriorAlCheckpoint', () => {
  it('sin checkpoint todo es posterior', () => {
    expect(esPosteriorAlCheckpoint(documento(1, 'a'), null)).toBe(true);
  });

  it('el propio checkpoint no es posterior a sí mismo', () => {
    const checkpoint: Checkpoint = { actualizadoEn: 2, id: 'b' };

    expect(esPosteriorAlCheckpoint(documento(2, 'b'), checkpoint)).toBe(false);
    expect(esPosteriorAlCheckpoint(documento(2, 'c'), checkpoint)).toBe(true);
    expect(esPosteriorAlCheckpoint(documento(2, 'a'), checkpoint)).toBe(false);
  });
});
