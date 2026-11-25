import { NOMBRE_DE_COLECCION_DOCUMENTS } from '@harukoia/schema';
import { describe, expect, it } from 'vitest';

import { escribirBatch, type OperacionDeCola } from './escribir-batch.ts';

type Query = { readonly sql: string; readonly params: unknown[] };

function poolDePrueba(consultas: Query[]) {
  return {
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        consultas.push({ sql, params: params ?? [] });
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        return { rows: [], rowCount: 1 };
      },
      release: () => {},
    }),
  };
}

describe('escribir-batch documents (H5 P2)', () => {
  it('acepta PUT de documents con sala correcta', async () => {
    const consultas: Query[] = [];
    const pool = poolDePrueba(consultas);
    const batch: OperacionDeCola[] = [
      {
        op: 'PUT',
        table: NOMBRE_DE_COLECCION_DOCUMENTS,
        id: 'docabcdefghjkmnp',
        data: {
          sala: 'sala-ok',
          commit_id: 'cmtabcdefghjkmnp',
          variante: 'markdown-determinista',
          estado_tipo: 'en-proceso',
          estado_causa: null,
          estado_marca: null,
          ruta_directorio: 'harukoia/publicado/cmtabcdefghjkmnp',
          ruta_tablero_json: 'harukoia/publicado/cmtabcdefghjkmnp/tablero.json',
          ruta_documento_markdown: 'harukoia/publicado/cmtabcdefghjkmnp/documento.md',
          creado_en: 1,
          actualizado_en: 2,
          borrado: false,
        },
      },
    ];

    const r = await escribirBatch(pool as never, 'sala-ok', batch);
    expect(r).toEqual({ ok: true, aplicadas: 1 });
    expect(consultas.some((c) => c.sql.includes('INSERT INTO documents'))).toBe(true);
  });

  it('rechaza documents con sala distinta', async () => {
    const consultas: Query[] = [];
    const pool = poolDePrueba(consultas);
    const r = await escribirBatch(pool as never, 'sala-ok', [
      {
        op: 'PUT',
        table: NOMBRE_DE_COLECCION_DOCUMENTS,
        id: 'docabcdefghjkmnp',
        data: {
          sala: 'otra',
          commit_id: 'cmtabcdefghjkmnp',
          variante: 'markdown-determinista',
          estado_tipo: 'en-proceso',
          ruta_directorio: 'harukoia/publicado/x',
          ruta_tablero_json: 'harukoia/publicado/x/tablero.json',
          ruta_documento_markdown: 'harukoia/publicado/x/documento.md',
          creado_en: 1,
        },
      },
    ]);
    expect(r).toEqual({ ok: false, causa: 'sala-no-coincide' });
    expect(consultas.some((c) => c.sql === 'ROLLBACK')).toBe(true);
  });

  it('sigue rechazando tablas no permitidas', async () => {
    const consultas: Query[] = [];
    const pool = poolDePrueba(consultas);
    const r = await escribirBatch(pool as never, 'sala-ok', [
      { op: 'PUT', table: 'attachments', id: 'x', data: { sala: 'sala-ok' } },
    ]);
    expect(r).toEqual({ ok: false, causa: 'tabla-no-permitida:attachments' });
  });
});
