import { describe, expect, it } from 'vitest';

import { CAMPOS_DE_DOCUMENTO_H5, comoFilaDeDocumento } from './fila-de-documento.ts';

const base = {
  id: 'docabcdefghjkmnp',
  actualizadoEn: 10,
  borrado: false,
  sala: 'salaabcdefghjkmn',
  commit: 'cmtabcdefghjkmnp',
  variante: 'markdown-determinista',
  rutaDirectorio: 'harukoia/publicado/cmtabcdefghjkmnp',
  rutaTableroJson: 'harukoia/publicado/cmtabcdefghjkmnp/tablero.json',
  rutaDocumentoMarkdown: 'harukoia/publicado/cmtabcdefghjkmnp/documento.md',
  creadoEn: 5,
};

describe('fila de documento', () => {
  it('acepta en-proceso sin causa ni marca', () => {
    const r = comoFilaDeDocumento({
      ...base,
      estadoTipo: 'en-proceso',
      estadoCausa: null,
      estadoMarca: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fila.estadoTipo).toBe('en-proceso');
    expect(r.fila.estadoCausa).toBeNull();
  });

  it('acepta publicado y fallido', () => {
    expect(
      comoFilaDeDocumento({
        ...base,
        estadoTipo: 'publicado',
        estadoCausa: null,
        estadoMarca: 99,
      }).ok,
    ).toBe(true);
    expect(
      comoFilaDeDocumento({
        ...base,
        estadoTipo: 'fallido',
        estadoCausa: 'sin remoto',
        estadoMarca: 99,
      }).ok,
    ).toBe(true);
  });

  it('rechaza estado desconocido y fallido sin causa', () => {
    expect(
      comoFilaDeDocumento({
        ...base,
        estadoTipo: 'reintento',
        estadoCausa: null,
        estadoMarca: null,
      }).ok,
    ).toBe(false);
    expect(
      comoFilaDeDocumento({
        ...base,
        estadoTipo: 'fallido',
        estadoCausa: '',
        estadoMarca: 1,
      }).ok,
    ).toBe(false);
  });

  it('lista solo campos H5 (sin attachments)', () => {
    expect(CAMPOS_DE_DOCUMENTO_H5).not.toContain('pdf');
    expect(CAMPOS_DE_DOCUMENTO_H5).not.toContain('word');
    expect(CAMPOS_DE_DOCUMENTO_H5).toContain('estadoTipo');
    expect(CAMPOS_DE_DOCUMENTO_H5).toContain('rutaDocumentoMarkdown');
  });
});
