import { generarIdentidadDeSala } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { guardarCredencialDeHost, leerCredencialDeHost } from './credencial-de-host.ts';

function almacenEnMemoria(): Pick<Storage, 'getItem' | 'setItem'> {
  const valores = new Map<string, string>();
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => void valores.set(clave, valor),
  };
}

describe('credencial de host', () => {
  it('se guarda por sala', () => {
    const almacen = almacenEnMemoria();
    const una = generarIdentidadDeSala();
    const otra = generarIdentidadDeSala();
    guardarCredencialDeHost(almacen, una.sala, una.tokenDeWebDelHost);

    expect(leerCredencialDeHost(almacen, una.sala)).toBe(una.tokenDeWebDelHost);
    expect(leerCredencialDeHost(almacen, otra.sala)).toBeUndefined();
  });

  it('un valor alterado no cuenta como credencial', () => {
    const almacen = almacenEnMemoria();
    const { sala } = generarIdentidadDeSala();
    almacen.setItem(`harukoia:credencial-de-host:${sala}`, 'no-es-un-token');

    expect(leerCredencialDeHost(almacen, sala)).toBeUndefined();
  });
});
