import type { Pool } from 'pg';

/** Operación de la cola de subida (forma del demo oficial de PowerSync). */
export type OperacionDeCola = {
  readonly op: 'PUT' | 'PATCH' | 'DELETE';
  readonly table: string;
  readonly id: string;
  readonly data?: Record<string, unknown>;
};

export type ResultadoDeBatch =
  | { readonly ok: true; readonly aplicadas: number }
  | { readonly ok: false; readonly causa: string };

const TABLA = 'commits_prueba';

/**
 * Aplica el batch en una sola transacción. Solo `commits_prueba`.
 * Si Postgres falla a mitad, hace ROLLBACK (sin fila a medias).
 */
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
      if (op.table !== TABLA) {
        await cliente.query('ROLLBACK');
        return { ok: false, causa: `tabla-no-permitida:${op.table}` };
      }
      if (op.op === 'PUT') {
        const fila = filaDePut(op, salaEsperada);
        if (!fila.ok) {
          await cliente.query('ROLLBACK');
          return fila;
        }
        await cliente.query(
          `INSERT INTO commits_prueba (
             id, sala, mensaje, autor, participantes, snapshot_b64, tablero_json, actualizado_en
           ) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
           ON CONFLICT (id) DO UPDATE SET
             mensaje = EXCLUDED.mensaje,
             autor = EXCLUDED.autor,
             participantes = EXCLUDED.participantes,
             snapshot_b64 = EXCLUDED.snapshot_b64,
             tablero_json = EXCLUDED.tablero_json,
             actualizado_en = now()`,
          [
            fila.valores.id,
            fila.valores.sala,
            fila.valores.mensaje,
            fila.valores.autor,
            fila.valores.participantes,
            fila.valores.snapshot_b64,
            fila.valores.tablero_json,
          ],
        );
        aplicadas += 1;
      } else if (op.op === 'PATCH') {
        await cliente.query('ROLLBACK');
        return { ok: false, causa: 'patch-no-soportado-en-pdc' };
      } else if (op.op === 'DELETE') {
        await cliente.query(`DELETE FROM commits_prueba WHERE id = $1 AND sala = $2`, [
          op.id,
          salaEsperada,
        ]);
        aplicadas += 1;
      } else {
        await cliente.query('ROLLBACK');
        return { ok: false, causa: `op-desconocida` };
      }
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

function filaDePut(
  op: OperacionDeCola,
  salaEsperada: string,
):
  | { readonly ok: true; readonly valores: Record<string, string> }
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
      sala,
      mensaje: String(data.mensaje ?? ''),
      autor: String(data.autor ?? ''),
      participantes: String(data.participantes ?? '[]'),
      snapshot_b64: String(data.snapshot_b64 ?? ''),
      tablero_json: String(data.tablero_json ?? '{}'),
    },
  };
}
