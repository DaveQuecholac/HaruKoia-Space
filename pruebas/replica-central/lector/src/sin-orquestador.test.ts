import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));

describe('lector sin relay', () => {
  it('el camino del lector no cablea ORQUESTADOR_URL ni rutas del relay', () => {
    const fuente = readFileSync(resolve(raiz, 'src/leer-commit.ts'), 'utf8');
    assert.doesNotMatch(fuente, /ORQUESTADOR_URL/);
    assert.doesNotMatch(fuente, /\/relay\//);
    assert.doesNotMatch(fuente, /wss:\/\/orquestador/);
    assert.match(fuente, /\/sync\/bootstrap/);
    assert.match(fuente, /POWERSYNC_PUBLIC_URL|powersyncUrl/);
  });
});
