import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { archivoDeLaCola } from './archivo-de-la-cola.ts';

describe('archivo de la cola de publicación', () => {
  it('sin variable, queda en data/cola-publicacion.json dentro del cwd', () => {
    expect(archivoDeLaCola({}, '/tmp/host')).toBe(
      path.resolve('/tmp/host', 'data', 'cola-publicacion.json'),
    );
  });

  it('con variable, usa esa ruta', () => {
    expect(archivoDeLaCola({ COLA_PUBLICACION: 'otro/cola.json' }, '/tmp/host')).toBe(
      path.resolve('otro/cola.json'),
    );
  });

  it('una variable vacía no se sustituye por el archivo por defecto', () => {
    expect(() => archivoDeLaCola({ COLA_PUBLICACION: '' }, '/tmp/host')).toThrow(
      'COLA_PUBLICACION está vacía',
    );
  });

  it('nunca apunta a sala.sqlite ni replica.sqlite', () => {
    const ruta = archivoDeLaCola({}, '/tmp/host');
    expect(ruta).not.toContain('sala.sqlite');
    expect(ruta).not.toContain('replica.sqlite');
    expect(ruta.endsWith('cola-publicacion.json')).toBe(true);
  });
});
