import { describe, expect, it } from 'vitest';

import { type Almacen, guardarNombre, leerNombre } from './nombre-recordado.ts';

function almacenEnMemoria(): Almacen {
  const valores = new Map<string, string>();
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => void valores.set(clave, valor),
  };
}

describe('nombre recordado', () => {
  it('la primera vez no hay nombre', () => {
    expect(leerNombre(almacenEnMemoria())).toBeUndefined();
  });

  it('la segunda vez se recuerda, sin espacios de sobra', () => {
    const almacen = almacenEnMemoria();
    guardarNombre(almacen, '  Ana  ');
    expect(leerNombre(almacen)).toBe('Ana');
  });

  it('un nombre en blanco cuenta como sin nombre', () => {
    const almacen = almacenEnMemoria();
    guardarNombre(almacen, '   ');
    expect(leerNombre(almacen)).toBeUndefined();
  });
});
