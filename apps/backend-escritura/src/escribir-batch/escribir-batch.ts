/**
 * Aplica el batch de la cola PowerSync a Postgres (commits + snapshots + documents).
 * Una sola transacción; Postgres caído → 503 vía causa postgres:…
 */

import {
  NOMBRE_DE_COLECCION_COMMITS,
  NOMBRE_DE_COLECCION_DOCUMENTS,
  NOMBRE_DE_COLECCION_SNAPSHOTS,
} from '@harukoia/schema';
import type { Pool } from 'pg';

export type OperacionDeCola = {
  readonly op: 'PUT' | 'PATCH' | 'DELETE';
  readonly table: string;
  readonly id: string;
  readonly data?: Record<string, unknown>;
};

export type ResultadoDeBatch =
  | { readonly ok: true; readonly aplicadas: number }
  | { readonly ok: false; readonly causa: string };

type TablaPermitida =
  | typeof NOMBRE_DE_COLECCION_COMMITS
  | typeof NOMBRE_DE_COLECCION_SNAPSHOTS
  | typeof NOMBRE_DE_COLECCION_DOCUMENTS;

function esTablaPermitida(tabla: string): tabla is TablaPermitida {
  return (
    tabla === NOMBRE_DE_COLECCION_COMMITS ||
    tabla === NOMBRE_DE_COLECCION_SNAPSHOTS ||
    tabla === NOMBRE_DE_COLECCION_DOCUMENTS
  );
}

export async function escribirBatch(
  pool: Pool,
  salaEsperada: string,
  batch: readonly OperacionDeCola[],
): Promise<ResultadoDeBatch> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    let aplicadas = 0;
    for (const op of batch) {
      if (!esTablaPermitida(op.table)) {
        await cliente.query('ROLLBACK');
        return { ok: false, causa: `tabla-no-permitida:${op.table}` };
      }
      if (op.op === 'PATCH') {
        await cliente.query('ROLLBACK');
        return { ok: false, causa: 'patch-no-soportado' };
      }
      if (op.op === 'DELETE') {
        if (op.table === NOMBRE_DE_COLECCION_COMMITS) {
          await cliente.query(`DELETE FROM commits WHERE id = $1 AND sala = $2`, [
            op.id,
            salaEsperada,
          ]);
        } else if (op.table === NOMBRE_DE_COLECCION_DOCUMENTS) {
          await cliente.query(`DELETE FROM documents WHERE id = $1 AND sala = $2`, [
            op.id,
            salaEsperada,
          ]);
        } else {
          await cliente.query(
            `DELETE FROM snapshots s USING commits c
             WHERE s.id = $1 AND s.id = c.id AND c.sala = $2`,
            [op.id, salaEsperada],
          );
        }
        aplicadas += 1;
        continue;
      }

      if (op.table === NOMBRE_DE_COLECCION_DOCUMENTS) {
        const doc = filaDeDocumento(op, salaEsperada);
        if (!doc.ok) {
          await cliente.query('ROLLBACK');
          return doc;
        }
        await cliente.query(
          `INSERT INTO documents (
             id, actualizado_en, borrado, sala, commit_id, variante,
             estado_tipo, estado_causa, estado_marca,
             ruta_directorio, ruta_tablero_json, ruta_documento_markdown, creado_en
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (id) DO UPDATE SET
             actualizado_en = EXCLUDED.actualizado_en,
             borrado = EXCLUDED.borrado,
             commit_id = EXCLUDED.commit_id,
             variante = EXCLUDED.variante,
             estado_tipo = EXCLUDED.estado_tipo,
             estado_causa = EXCLUDED.estado_causa,
             estado_marca = EXCLUDED.estado_marca,
             ruta_directorio = EXCLUDED.ruta_directorio,
             ruta_tablero_json = EXCLUDED.ruta_tablero_json,
             ruta_documento_markdown = EXCLUDED.ruta_documento_markdown,
             creado_en = EXCLUDED.creado_en`,
          [
            doc.valores.id,
            doc.valores.actualizado_en,
            doc.valores.borrado,
            doc.valores.sala,
            doc.valores.commit_id,
            doc.valores.variante,
            doc.valores.estado_tipo,
            doc.valores.estado_causa,
            doc.valores.estado_marca,
            doc.valores.ruta_directorio,
            doc.valores.ruta_tablero_json,
            doc.valores.ruta_documento_markdown,
            doc.valores.creado_en,
          ],
        );
        aplicadas += 1;
        continue;
      }

      if (op.table === NOMBRE_DE_COLECCION_COMMITS) {
        const fila = filaDeCommit(op, salaEsperada);
        if (!fila.ok) {
          await cliente.query('ROLLBACK');
          return fila;
        }
        await cliente.query(
          `INSERT INTO commits (
             id, actualizado_en, borrado, sala, padre, mensaje, autor, participantes, creado_en
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             actualizado_en = EXCLUDED.actualizado_en,
             borrado = EXCLUDED.borrado,
             padre = EXCLUDED.padre,
             mensaje = EXCLUDED.mensaje,
             autor = EXCLUDED.autor,
             participantes = EXCLUDED.participantes,
             creado_en = EXCLUDED.creado_en`,
          [
            fila.valores.id,
            fila.valores.actualizado_en,
            fila.valores.borrado,
            fila.valores.sala,
            fila.valores.padre,
            fila.valores.mensaje,
            fila.valores.autor,
            fila.valores.participantes,
            fila.valores.creado_en,
          ],
        );
        aplicadas += 1;
        continue;
      }

      const snap = filaDeSnapshot(op);
      if (!snap.ok) {
        await cliente.query('ROLLBACK');
        return snap;
      }
      await cliente.query(
        `INSERT INTO snapshots (
           id, actualizado_en, borrado, estado_yjs_base64, tablero_json, formato_de_tablero
         ) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           actualizado_en = EXCLUDED.actualizado_en,
           borrado = EXCLUDED.borrado,
           estado_yjs_base64 = EXCLUDED.estado_yjs_base64,
           tablero_json = EXCLUDED.tablero_json,
           formato_de_tablero = EXCLUDED.formato_de_tablero`,
        [
          snap.valores.id,
          snap.valores.actualizado_en,
          snap.valores.borrado,
          snap.valores.estado_yjs_base64,
          snap.valores.tablero_json,
          snap.valores.formato_de_tablero,
        ],
      );
      aplicadas += 1;
    }
    await cliente.query('COMMIT');
    return { ok: true, aplicadas };
  } catch (error) {
    try {
      await cliente.query('ROLLBACK');
    } catch {
      /* ya abortada */
    }
    const causa = error instanceof Error ? error.message : String(error);
    return { ok: false, causa: `postgres:${causa}` };
  } finally {
    cliente.release();
  }
}

function filaDeCommit(
  op: OperacionDeCola,
  salaEsperada: string,
):
  | {
      readonly ok: true;
      readonly valores: {
        id: string;
        actualizado_en: number;
        borrado: boolean;
        sala: string;
        padre: string | null;
        mensaje: string;
        autor: string;
        participantes: string;
        creado_en: number;
      };
    }
  | { readonly ok: false; readonly causa: string } {
  const data = op.data ?? {};
  const sala = String(data.sala ?? '');
  if (sala !== salaEsperada) {
    return { ok: false, causa: 'sala-no-coincide' };
  }
  return {
    ok: true,
    valores: {
      id: op.id,
      actualizado_en: numero(data.actualizado_en ?? data.actualizadoEn, Date.now()),
      borrado: booleano(data.borrado),
      sala,
      padre: data.padre === null || data.padre === undefined ? null : String(data.padre),
      mensaje: String(data.mensaje ?? ''),
      autor: String(data.autor ?? ''),
      participantes: String(data.participantes ?? '[]'),
      creado_en: numero(data.creado_en ?? data.creadoEn, Date.now()),
    },
  };
}

function filaDeSnapshot(
  op: OperacionDeCola,
):
  | {
      readonly ok: true;
      readonly valores: {
        id: string;
        actualizado_en: number;
        borrado: boolean;
        estado_yjs_base64: string;
        tablero_json: string;
        formato_de_tablero: number;
      };
    }
  | { readonly ok: false; readonly causa: string } {
  const data = op.data ?? {};
  return {
    ok: true,
    valores: {
      id: op.id,
      actualizado_en: numero(data.actualizado_en ?? data.actualizadoEn, Date.now()),
      borrado: booleano(data.borrado),
      estado_yjs_base64: String(data.estado_yjs_base64 ?? data.estadoYjsBase64 ?? ''),
      tablero_json: String(data.tablero_json ?? data.tableroJson ?? '{}'),
      formato_de_tablero: numero(data.formato_de_tablero ?? data.formatoDeTablero, 1),
    },
  };
}

function filaDeDocumento(
  op: OperacionDeCola,
  salaEsperada: string,
):
  | {
      readonly ok: true;
      readonly valores: {
        id: string;
        actualizado_en: number;
        borrado: boolean;
        sala: string;
        commit_id: string;
        variante: string;
        estado_tipo: string;
        estado_causa: string | null;
        estado_marca: number | null;
        ruta_directorio: string;
        ruta_tablero_json: string;
        ruta_documento_markdown: string;
        creado_en: number;
      };
    }
  | { readonly ok: false; readonly causa: string } {
  const data = op.data ?? {};
  const sala = String(data.sala ?? '');
  if (sala !== salaEsperada) {
    return { ok: false, causa: 'sala-no-coincide' };
  }
  const estadoTipo = String(data.estado_tipo ?? data.estadoTipo ?? '');
  if (estadoTipo !== 'en-proceso' && estadoTipo !== 'publicado' && estadoTipo !== 'fallido') {
    return { ok: false, causa: 'estado-tipo-invalido' };
  }

  let estadoCausa: string | null = null;
  let estadoMarca: number | null = null;
  if (estadoTipo === 'publicado') {
    estadoMarca = numero(data.estado_marca ?? data.estadoMarca, Date.now());
  } else if (estadoTipo === 'fallido') {
    const causa = String(data.estado_causa ?? data.estadoCausa ?? '').trim();
    if (causa === '') return { ok: false, causa: 'estado-causa-invalida' };
    estadoCausa = causa;
    estadoMarca = numero(data.estado_marca ?? data.estadoMarca, Date.now());
  }

  return {
    ok: true,
    valores: {
      id: op.id,
      actualizado_en: numero(data.actualizado_en ?? data.actualizadoEn, Date.now()),
      borrado: booleano(data.borrado),
      sala,
      commit_id: String(data.commit_id ?? data.commit ?? ''),
      variante: String(data.variante ?? ''),
      estado_tipo: estadoTipo,
      estado_causa: estadoCausa,
      estado_marca: estadoMarca,
      ruta_directorio: String(data.ruta_directorio ?? data.rutaDirectorio ?? ''),
      ruta_tablero_json: String(data.ruta_tablero_json ?? data.rutaTableroJson ?? ''),
      ruta_documento_markdown: String(
        data.ruta_documento_markdown ?? data.rutaDocumentoMarkdown ?? '',
      ),
      creado_en: numero(data.creado_en ?? data.creadoEn, Date.now()),
    },
  };
}

function numero(valor: unknown, respaldo: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : respaldo;
}

function booleano(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor;
  if (valor === 1 || valor === '1' || valor === 'true') return true;
  return false;
}
