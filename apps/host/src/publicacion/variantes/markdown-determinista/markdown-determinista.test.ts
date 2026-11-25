import {
  FORMATO_DE_TABLERO,
  generarIdentificadorDeCommit,
  rutasDePublicacionDelCommit,
} from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { crearTrabajoDePublicacion } from '../../trabajo-de-publicacion/trabajo-de-publicacion.ts';
import {
  ID_VARIANTE_MARKDOWN_DETERMINISTA,
  crearVarianteMarkdownDeterminista,
} from './markdown-determinista.ts';

describe('variante markdown-determinista (plugin P5)', () => {
  it('produce documento.md y tablero.json bajo el prefijo publicado', async () => {
    const commit = generarIdentificadorDeCommit();
    const trabajo = crearTrabajoDePublicacion({
      commit,
      variante: ID_VARIANTE_MARKDOWN_DETERMINISTA,
      creadoEn: 1,
    });
    const variante = crearVarianteMarkdownDeterminista();
    expect(variante.id).toBe('markdown-determinista');

    const resultado = await variante.producir({
      trabajo,
      entrada: {
        commit: {
          id: commit,
          mensaje: 'ok',
          autor: 'Hector',
          participantes: ['Hector'],
          creadoEn: Date.UTC(2026, 0, 1),
        },
        tablero: { formato: FORMATO_DE_TABLERO, formas: [] },
      },
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const rutas = rutasDePublicacionDelCommit(commit);
    expect(resultado.artefactos.map((a) => a.rutaRelativa).sort()).toEqual(
      [rutas.documentoMarkdown, rutas.tableroJson].sort(),
    );
    for (const a of resultado.artefactos) {
      expect(a.bytes.byteLength).toBeGreaterThan(0);
    }
  });
});
