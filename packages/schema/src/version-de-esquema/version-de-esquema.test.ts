import { describe, expect, it } from 'vitest';

import {
  type DefinicionDeEsquema,
  migrar,
  validarDefinicion,
} from './version-de-esquema.ts';

// Esquema de juguete, solo para las pruebas: nombre suelto → nombre y apellido.
const ejemplo: DefinicionDeEsquema = {
  nombre: 'ejemplo',
  version: 2,
  migraciones: {
    0: (documento) => ({ ...documento, nombre: documento['nombre'] ?? 'sin nombre' }),
    1: (documento) => ({ ...documento, apellido: documento['apellido'] ?? '' }),
  },
};

describe('validación de la definición', () => {
  it('acepta una definición completa', () => {
    expect(() => validarDefinicion(ejemplo)).not.toThrow();
  });

  it('acepta la versión cero sin migraciones', () => {
    expect(() => validarDefinicion({ nombre: 'nueva', version: 0, migraciones: {} })).not.toThrow();
  });

  it('rechaza un hueco en la cadena de migraciones', () => {
    const conHueco: DefinicionDeEsquema = {
      nombre: 'con-hueco',
      version: 3,
      migraciones: { 0: (d) => d, 2: (d) => d },
    };

    expect(() => validarDefinicion(conHueco)).toThrow(/falta la migración de la versión 1/);
  });

  it('rechaza migraciones de versiones que no existen', () => {
    const sobrante: DefinicionDeEsquema = {
      nombre: 'sobrante',
      version: 1,
      migraciones: { 0: (d) => d, 1: (d) => d },
    };

    expect(() => validarDefinicion(sobrante)).toThrow(/no existen/);
  });

  it('rechaza una versión que no es un entero no negativo', () => {
    expect(() => validarDefinicion({ nombre: 'x', version: -1, migraciones: {} })).toThrow(
      RangeError,
    );
    expect(() => validarDefinicion({ nombre: 'x', version: 1.5, migraciones: {} })).toThrow(
      RangeError,
    );
  });
});

describe('migración de documentos', () => {
  it('lleva un documento viejo hasta la versión vigente', () => {
    const viejo = { id: 'abc' };

    expect(migrar(viejo, 0, ejemplo)).toEqual({ id: 'abc', nombre: 'sin nombre', apellido: '' });
  });

  it('aplica solo las migraciones que faltan', () => {
    const aMedias = { id: 'abc', nombre: 'Kua' };

    expect(migrar(aMedias, 1, ejemplo)).toEqual({ id: 'abc', nombre: 'Kua', apellido: '' });
  });

  it('deja intacto un documento que ya está al día', () => {
    const alDia = { id: 'abc', nombre: 'Kua', apellido: 'Arreola' };

    expect(migrar(alDia, 2, ejemplo)).toBe(alDia);
  });

  it('no migra hacia atrás', () => {
    expect(() => migrar({ id: 'abc' }, 3, ejemplo)).toThrow(/No se migra hacia atrás/);
  });

  it('rechaza una versión de documento inválida', () => {
    expect(() => migrar({}, -1, ejemplo)).toThrow(RangeError);
    expect(() => migrar({}, 0.5, ejemplo)).toThrow(RangeError);
  });

  it('no modifica el documento original', () => {
    const original = { id: 'abc' };

    migrar(original, 0, ejemplo);

    expect(original).toEqual({ id: 'abc' });
  });
});
