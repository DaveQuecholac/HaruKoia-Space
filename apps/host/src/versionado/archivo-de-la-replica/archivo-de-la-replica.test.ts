import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { archivoDeLaReplica } from './archivo-de-la-replica.ts';

describe('archivo de la réplica', () => {
  it('sin variable, queda en data/replica.sqlite dentro del cwd', () => {
    expect(archivoDeLaReplica({}, '/tmp/host')).toBe(
      path.resolve('/tmp/host', 'data', 'replica.sqlite'),
    );
  });

  it('con variable, usa esa ruta', () => {
    expect(archivoDeLaReplica({ REPLICA_SQLITE: 'otro/replica.sqlite' }, '/tmp/host')).toBe(
      path.resolve('otro/replica.sqlite'),
    );
  });

  it('una variable vacía no se sustituye por el archivo por defecto', () => {
    expect(() => archivoDeLaReplica({ REPLICA_SQLITE: '' }, '/tmp/host')).toThrow(
      'REPLICA_SQLITE está vacía',
    );
  });

  it('nunca apunta a sala.sqlite por defecto (F-V6)', () => {
    const ruta = archivoDeLaReplica({}, '/tmp/host');
    expect(ruta).not.toContain('sala.sqlite');
    expect(ruta.endsWith('replica.sqlite')).toBe(true);
  });
});
