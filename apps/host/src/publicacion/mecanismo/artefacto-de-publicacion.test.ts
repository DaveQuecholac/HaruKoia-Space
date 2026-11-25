import { rutasDePublicacionDelCommit, generarIdentificadorDeCommit } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { crearArtefactoDePublicacion } from './artefacto-de-publicacion.ts';

describe('artefacto de publicación', () => {
  it('acepta ruta bajo el prefijo y bytes no vacíos', () => {
    const commit = generarIdentificadorDeCommit();
    const ruta = rutasDePublicacionDelCommit({
      commit,
      creadoEn: 1,
      autor: 't',
      mensaje: 'm',
    }).documentoMarkdown;
    const creado = crearArtefactoDePublicacion(ruta, new TextEncoder().encode('# ok'));
    expect(creado.ok).toBe(true);
  });

  it('rechaza ruta fuera del prefijo', () => {
    const creado = crearArtefactoDePublicacion('docs/manual.md', new TextEncoder().encode('x'));
    expect(creado.ok).toBe(false);
    if (creado.ok) return;
    expect(creado.causa).toBe('ruta-invalida');
  });

  it('rechaza bytes vacíos', () => {
    const commit = generarIdentificadorDeCommit();
    const ruta = rutasDePublicacionDelCommit({
      commit,
      creadoEn: 1,
      autor: 't',
      mensaje: 'm',
    }).documentoMarkdown;
    const creado = crearArtefactoDePublicacion(ruta, new Uint8Array());
    expect(creado.ok).toBe(false);
    if (creado.ok) return;
    expect(creado.causa).toBe('bytes-vacios');
  });
});
