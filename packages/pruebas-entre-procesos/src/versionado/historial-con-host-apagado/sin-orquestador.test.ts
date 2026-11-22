import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const carpeta = resolve(fileURLToPath(import.meta.url), '..');

describe('lector V7 sin relay', () => {
  it('el camino del lector no cablea ORQUESTADOR_URL ni rutas del relay', () => {
    const fuente = readFileSync(resolve(carpeta, 'leer-historial-replica.ts'), 'utf8');
    expect(fuente).not.toMatch(/ORQUESTADOR_URL/);
    expect(fuente).not.toMatch(/\/relay\//);
    expect(fuente).not.toMatch(/wss:\/\/orquestador/);
    expect(fuente).toMatch(/\/sync\/bootstrap/);
    expect(fuente).toMatch(/POWERSYNC_PUBLIC_URL|powersyncUrl/);
    expect(fuente).toMatch(/host no requerido/);
  });
});
