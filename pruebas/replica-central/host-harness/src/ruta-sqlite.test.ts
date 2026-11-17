import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

import { rutaDelSqliteDelHarness } from './ruta-sqlite.ts';

const raiz = resolve('/tmp/pdc-raiz-falsa');

describe('rutaDelSqliteDelHarness', () => {
  it('acepta un archivo bajo tmp/', () => {
    const r = rutaDelSqliteDelHarness(raiz, 'tmp/host-harness.db');
    assert.equal(r.dbFilename, 'host-harness.db');
    assert.ok(r.absoluta.endsWith('/tmp/host-harness.db'));
  });

  it('rechaza sala.sqlite del host de producto', () => {
    assert.throws(() => rutaDelSqliteDelHarness(raiz, 'apps/host/data/sala.sqlite'), /prohibida/);
    assert.throws(
      () => rutaDelSqliteDelHarness(raiz, 'tmp/../apps/host/data/sala.sqlite'),
      /prohibida|bajo/,
    );
  });
});
