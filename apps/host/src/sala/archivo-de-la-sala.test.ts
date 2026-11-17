import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { archivoDeLaSala } from './archivo-de-la-sala.ts';

describe('archivo de la sala', () => {
  it('sin variable, queda en data/sala.sqlite dentro del cwd', () => {
    expect(archivoDeLaSala({}, '/tmp/host')).toBe(path.resolve('/tmp/host', 'data', 'sala.sqlite'));
  });

  it('con variable, usa esa ruta', () => {
    expect(archivoDeLaSala({ SALA_SQLITE: 'otro/sala.sqlite' }, '/tmp/host')).toBe(
      path.resolve('otro/sala.sqlite'),
    );
  });

  it('una variable vacía no se sustituye por el archivo por defecto', () => {
    expect(() => archivoDeLaSala({ SALA_SQLITE: '' }, '/tmp/host')).toThrow('SALA_SQLITE está vacía');
  });
});
