import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { guardarDocumento, nombreDeArchivo, tituloDeDocumento } from './guardar-documento.ts';

let raiz: string | undefined;

afterEach(async () => {
  if (raiz) await rm(raiz, { recursive: true, force: true });
  raiz = undefined;
});

describe('guardar el documento', () => {
  it('escribe el título y, si ya existe, la siguiente versión sin pisar la anterior', async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'harukoia-doc-'));

    const primera = await guardarDocumento(raiz, 'Perros bonitos', '# Uno\n');
    const segunda = await guardarDocumento(raiz, 'Perros bonitos', '# Dos\n');
    const tercera = await guardarDocumento(raiz, '  Perros bonitos  ', '# Tres\n');

    expect(primera).toBe('Harukoia/documentacion/Perros bonitos.md');
    expect(segunda).toBe('Harukoia/documentacion/Perros bonitos v2.md');
    expect(tercera).toBe('Harukoia/documentacion/Perros bonitos v3.md');
    expect(await readFile(path.join(raiz, primera), 'utf8')).toBe('# Uno\n');
    expect(await readFile(path.join(raiz, segunda), 'utf8')).toBe('# Dos\n');
    expect(nombreDeArchivo('Perros bonitos', 1)).toBe('Perros bonitos.md');
    expect(nombreDeArchivo('Perros bonitos', 2)).toBe('Perros bonitos v2.md');
  });

  it('rechaza un título vacío o con separador de ruta', () => {
    expect(tituloDeDocumento('  ')).toBeNull();
    expect(tituloDeDocumento('a/b')).toBeNull();
    expect(tituloDeDocumento('..')).toBeNull();
    expect(tituloDeDocumento('Junta')).toBe('Junta');
  });
});
