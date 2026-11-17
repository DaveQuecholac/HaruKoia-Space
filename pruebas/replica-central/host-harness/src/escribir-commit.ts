/**
 * Host harness de la PdC (R4): escribe un commit de prueba en SQLite PowerSync
 * y lo sube al backend de escritura. No toca apps/host ni el orquestador.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

import { PowerSyncDatabase } from '@powersync/node';

import { esquemaDePrueba } from './esquema.ts';
import { rutaDelSqliteDelHarness } from './ruta-sqlite.ts';

const raizPrueba = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workerPath = resolve(fileURLToPath(new URL('../powersync.worker.cjs', import.meta.url)));

const backendUrl = obligatorio('BACKEND_ESCRITURA_URL');
const sala = obligatorio('SALA_PRUEBA');
const tokenDeHost = obligatorio('TOKEN_DE_HOST_PRUEBA');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const databaseUrl = obligatorio('DATABASE_URL');
const relativaDb = process.env.HOST_HARNESS_DB ?? './tmp/host-harness.db';

const id = `cmt_pdc_r4_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
const mensaje = `commit harness R4 ${id}`;
const snapshot_b64 = Buffer.from('snapshot-pdc-r4').toString('base64');
const tablero_json = JSON.stringify({ formas: [{ id: 'f-r4', tipo: 'nota' }] });
const ahora = new Date().toISOString();

const ruta = rutaDelSqliteDelHarness(raizPrueba, relativaDb.replace(/^\.\//, ''));
mkdirSync(ruta.dbLocation, { recursive: true });

const db = new PowerSyncDatabase({
  schema: esquemaDePrueba,
  database: {
    dbFilename: ruta.dbFilename,
    dbLocation: ruta.dbLocation,
    openWorker: (_factoryPath, options) => new Worker(workerPath, options),
  },
});

async function main(): Promise<void> {
  console.info('harness', { sqlite: ruta.absoluta, id, backendUrl });

  await db.connect({
    async fetchCredentials() {
      const res = await fetch(`${backendUrl}/sync/bootstrap`);
      if (!res.ok) throw new Error(`bootstrap ${res.status}`);
      const cuerpo = (await res.json()) as { powersyncUrl: string; token: string };
      return { endpoint: cuerpo.powersyncUrl || powersyncUrl, token: cuerpo.token };
    },
    async uploadData(database) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) return;

      const batch = tx.crud.map((op) => ({
        op: op.op,
        table: op.table,
        id: op.id,
        data: op.opData,
      }));

      const res = await fetch(`${backendUrl}/api/data`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenDeHost}`,
        },
        body: JSON.stringify({ sala, batch }),
      });

      if (res.status >= 500) {
        throw new Error(`backend temporal ${res.status}: ${await res.text()}`);
      }

      const cuerpo = (await res.json()) as { ok?: boolean; causa?: string };
      if (cuerpo.ok === false) {
        console.warn('subida rechazada', cuerpo.causa);
        // Completar para que la cola avance; el espejo se alinea al sync (F-R1).
        await tx.complete();
        return;
      }

      await tx.complete();
      console.info('subida aceptada', { ops: batch.length });
    },
  });

  await db.execute(
    `INSERT INTO commits_prueba (
       id, sala, mensaje, autor, participantes, creado_en, snapshot_b64, tablero_json, actualizado_en
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sala,
      mensaje,
      'host-harness',
      JSON.stringify(['host-harness']),
      ahora,
      snapshot_b64,
      tablero_json,
      ahora,
    ],
  );
  console.info('escrito en sqlite local', { id });

  const ok = await esperarFilaEnPostgres(id, 30_000);
  await db.disconnect();
  await db.close();

  if (!ok) {
    console.error('timeout: la fila no llegó a Postgres', { id });
    process.exit(1);
  }
  console.info('ok: fila en Postgres vía backend', { id, mensaje });
}

async function esperarFilaEnPostgres(commitId: string, limiteMs: number): Promise<boolean> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  const inicio = Date.now();
  try {
    while (Date.now() - inicio < limiteMs) {
      const r = await pool.query<{ id: string; mensaje: string }>(
        'SELECT id, mensaje FROM commits_prueba WHERE id = $1',
        [commitId],
      );
      if (r.rowCount && r.rows[0]?.mensaje === mensaje) return true;
      await new Promise((l) => setTimeout(l, 400));
    }
    return false;
  } finally {
    await pool.end();
  }
}

function obligatorio(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`falta ${nombre}`);
  return valor;
}

main().catch(async (error) => {
  console.error(error);
  try {
    await db.disconnect();
    await db.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
