import { describe, expect, it } from 'vitest';

import { generarIdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import { type Identificador } from '../../identificador/identificador.ts';
import { generarIdentidadDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import {
  comoDocumentoPublicado,
  crearDocumentoPublicado,
  type DocumentoPublicado,
} from './documento-publicado.ts';

describe('documento publicado', () => {
  it('crea con rutas canónicas y estado en-proceso', () => {
    const { sala } = generarIdentidadDeSala();
    const commit = generarIdentificadorDeCommit();
    const creado = crearDocumentoPublicado({
      sala,
      commit,
      variante: 'markdown-determinista',
      estado: { tipo: 'en-proceso' },
      creadoEn: 100,
    });
    expect(creado.ok).toBe(true);
    if (!creado.ok) return;
    expect(creado.documento.commit).toBe(commit);
    expect(creado.documento.rutas.tableroJson).toContain(commit);
    expect(creado.documento.rutas.documentoMarkdown.endsWith('documento.md')).toBe(true);
    expect(creado.documento.estado.tipo).toBe('en-proceso');
  });

  it('rechaza rutas fuera del prefijo', () => {
    const { sala } = generarIdentidadDeSala();
    const commit = generarIdentificadorDeCommit();
    const creado = crearDocumentoPublicado({
      sala,
      commit,
      variante: 'markdown-determinista',
      estado: { tipo: 'en-proceso' },
      creadoEn: 1,
      rutas: {
        directorio: 'docs/otro',
        tableroJson: 'docs/otro/tablero.json',
        documentoMarkdown: 'docs/otro/documento.md',
      },
    });
    expect(creado.ok).toBe(false);
  });

  it('interpreta un objeto crudo', () => {
    const { sala } = generarIdentidadDeSala();
    const commit = generarIdentificadorDeCommit();
    const base = crearDocumentoPublicado({
      sala,
      commit,
      variante: 'markdown-determinista',
      estado: { tipo: 'publicado', publicadoEn: 50 },
      creadoEn: 40,
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const otra = comoDocumentoPublicado(base.documento);
    expect(otra.id).toBe(base.documento.id);
    expect(otra.estado).toEqual({ tipo: 'publicado', publicadoEn: 50 });
  });

  it('tipado: commit no es DocumentoPublicado.id', () => {
    const commit = 'abcdefghjkmnpqrs' as Identificador<'commit'>;
    type IdDeDocumento = DocumentoPublicado['id'];
    // @ts-expect-error el id del documento no es un commit
    const _id: IdDeDocumento = commit;
    void _id;
    expect(typeof commit).toBe('string');
  });
});
