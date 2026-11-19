/**
 * Aplica el batch de la cola PowerSync a Postgres (commits + snapshots).
 * Una sola transacción; Postgres caído → 503 vía causa postgres:…
 */

import {
  NOMBRE_DE_COLECCION_COMMITS,
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
  | typeof NOMBRE_DE_COLECCION_SNAPSHOTS;

function esTablaPermitida(tabla: string): tabla is TablaPermitida {
  return tabla === NOMBRE_DE_COLECCION_COMMITS || tabla === NOMBRE_DE_COLECCION_SNAPSHOTS;
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

function numero(valor: unknown, respaldo: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : respaldo;
}

function booleano(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor;
  if (valor === 1 || valor === '1' || valor === 'true') return true;
  return false;
}
