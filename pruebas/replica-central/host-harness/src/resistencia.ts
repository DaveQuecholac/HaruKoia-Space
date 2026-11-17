/**
 * R6 — Resistencia de la PdC: criterios 1, 2 y 5 + medición (a).
 */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

import { PowerSyncDatabase } from '@powersync/node';
import { Pool } from 'pg';

import { esquemaDePrueba } from './esquema.ts';

const raizPrueba = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workerPath = resolve(fileURLToPath(new URL('../powersync.worker.cjs', import.meta.url)));

const backendUrl = obligatorio('BACKEND_ESCRITURA_URL');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const sala = obligatorio('SALA_PRUEBA');
const tokenDeHost = obligatorio('TOKEN_DE_HOST_PRUEBA');
const databaseUrl = obligatorio('DATABASE_URL');

const pool = new Pool({ connectionString: databaseUrl });
let fallos = 0;

async function main(): Promise<void> {
  console.info('=== R6 resistencia ===');

  await casoIntruso();
  await casoSinRedLuegoSube();
  await casoRechazoRevierte();
  const ms = await medicionSanaHastaLector();

  console.info('=== mediciones ===');
  console.info({ msEscrituraHastaLector: ms });
  console.info(fallos === 0 ? 'ok: criterios 1, 2 y 5' : `FALLÓ con ${fallos} caso(s)`);
  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
}

/** Criterio 2 / F-R2 — token inventado no escribe. */
async function casoIntruso(): Promise<void> {
  const id = nuevoId('intruso');
  const res = await fetch(`${backendUrl}/api/data`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-inventado-pdc',
    },
    body: JSON.stringify({
      sala,
      batch: [
        {
          op: 'PUT',
          table: 'commits_prueba',
          id,
          data: {
            sala,
            mensaje: 'intruso',
            autor: 'x',
            participantes: '[]',
            snapshot_b64: '',
            tablero_json: '{}',
          },
        },
      ],
    }),
  });
  const cuerpo = (await res.json()) as { ok?: boolean; causa?: string };
  const filas = await contar(id);
  const ok = res.status === 200 && cuerpo.ok === false && cuerpo.causa === 'host-no-autorizado' && filas === 0;
  reportar('criterio 2 intruso', ok, { status: res.status, cuerpo, filas });
}

/**
 * Criterio 1 / F-R3 — con “red cortada” la cola no sube; al restaurar, sí.
 */
async function casoSinRedLuegoSube(): Promise<void> {
  const id = nuevoId('sinred');
  const mensaje = `sin-red ${id}`;
  let redCortada = true;
  const db = await abrirDb(`sinred-${id}`, {
    async uploadData(database) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) return;
      if (redCortada) {
        console.info('simula red cortada: no sube');
        throw new Error('red-cortada');
      }
      await subir(tx);
    },
  });

  try {
    await insertar(db, id, mensaje, sala);
    await pausa(1500);
    const duranteCorte = await contar(id);
    if (duranteCorte !== 0) {
      reportar('criterio 1 mientras cortado', false, { duranteCorte });
      return;
    }
    redCortada = false;
    // Fuerza reintento de la cola.
    await db.disconnect();
    await db.connect({
      async fetchCredentials() {
        return bootstrap();
      },
      async uploadData(database) {
        const tx = await database.getNextCrudTransaction();
        if (!tx) return;
        await subir(tx);
      },
    });
    const llego = await esperarPostgres(id, mensaje, 45_000);
    const visto = llego ? await lectorVe(id) : false;
    reportar('criterio 1 sin red → sube', llego && visto, { llego, visto });
  } finally {
    await cerrar(db);
  }
}

/**
 * Criterio 5 / F-R1 — rechazo del backend: complete + sync revierte en el host.
 */
async function casoRechazoRevierte(): Promise<void> {
  const id = nuevoId('rechazo');
  const mensaje = `rechazo ${id}`;
  let ultimaCausa = '';
  const db = await abrirDb(`rechazo-${id}`, {
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
      const cuerpo = (await res.json()) as { ok?: boolean; causa?: string };
      if (cuerpo.ok === false) {
        ultimaCausa = cuerpo.causa ?? '';
        console.warn('rechazo visible', ultimaCausa);
        await tx.complete();
        return;
      }
      await tx.complete();
    },
  });

  try {
    // Sala distinta en la fila → backend rechaza (host token sí válido).
    await insertar(db, id, mensaje, 'sala-rechazada-pdc');
    await pausa(2000);
    const enPostgres = await contar(id);
    await Promise.race([
      db.waitForFirstSync(),
      new Promise<void>((l) => setTimeout(l, 8_000)),
    ]);
    await pausa(1000);
    const local = await db.getOptional<{ id: string }>(
      'SELECT id FROM commits_prueba WHERE id = ?',
      [id],
    );
    const ok =
      enPostgres === 0 &&
      ultimaCausa.length > 0 &&
      local == null;
    reportar('criterio 5 rechazo revierte', ok, { enPostgres, ultimaCausa, local });
  } finally {
    await cerrar(db);
  }
}

/** Medición (a): escritura → observación en lector. */
async function medicionSanaHastaLector(): Promise<number> {
  const id = nuevoId('lat');
  const mensaje = `latencia ${id}`;
  const db = await abrirDb(`lat-${id}`, {
    async uploadData(database) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) return;
      await subir(tx);
    },
  });
  const t0 = Date.now();
  try {
    await insertar(db, id, mensaje, sala);
    const visto = await esperar(() => lectorVe(id), 45_000);
    const ms = Date.now() - t0;
    reportar('medición escritura→lector', visto, { ms });
    return visto ? ms : -1;
  } finally {
    await cerrar(db);
  }
}

async function abrirDb(
  etiqueta: string,
  connector: {
    uploadData: (database: PowerSyncDatabase) => Promise<void>;
  },
): Promise<PowerSyncDatabase> {
  const dir = resolve(raizPrueba, 'tmp', `res-${etiqueta}-${randomBytes(2).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const db = new PowerSyncDatabase({
    schema: esquemaDePrueba,
    database: {
      dbFilename: 'res.db',
      dbLocation: dir,
      openWorker: (_f, options) => new Worker(workerPath, options),
    },
  });
  (db as unknown as { __dir?: string }).__dir = dir;
  await db.connect({
    async fetchCredentials() {
      return bootstrap();
    },
    uploadData: connector.uploadData,
  });
  return db;
}

async function cerrar(db: PowerSyncDatabase): Promise<void> {
  const dir = (db as unknown as { __dir?: string }).__dir;
  try {
    await db.disconnect();
    await db.close();
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

async function bootstrap(): Promise<{ endpoint: string; token: string }> {
  const res = await fetch(`${backendUrl}/sync/bootstrap`);
  if (!res.ok) throw new Error(`bootstrap ${res.status}`);
  const cuerpo = (await res.json()) as { powersyncUrl: string; token: string };
  return { endpoint: cuerpo.powersyncUrl || powersyncUrl, token: cuerpo.token };
}

async function subir(tx: {
  crud: ReadonlyArray<{ op: string; table: string; id: string; opData?: Record<string, unknown> }>;
  complete: () => Promise<void>;
}): Promise<void> {
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
  if (res.status >= 500) throw new Error(`backend ${res.status}`);
  const cuerpo = (await res.json()) as { ok?: boolean; causa?: string };
  if (cuerpo.ok === false) {
    console.warn('subida rechazada', cuerpo.causa);
    await tx.complete();
    return;
  }
  await tx.complete();
}

async function insertar(
  db: PowerSyncDatabase,
  id: string,
  mensaje: string,
  salaFila: string,
): Promise<void> {
  const ahora = new Date().toISOString();
  await db.execute(
    `INSERT INTO commits_prueba (
       id, sala, mensaje, autor, participantes, creado_en, snapshot_b64, tablero_json, actualizado_en
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, salaFila, mensaje, 'resistencia', '[]', ahora, 'c25hcA==', '{}', ahora],
  );
}

async function lectorVe(id: string): Promise<boolean> {
  const dir = resolve(raizPrueba, 'tmp', `lec-${randomBytes(2).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const db = new PowerSyncDatabase({
    schema: esquemaDePrueba,
    database: {
      dbFilename: 'lec.db',
      dbLocation: dir,
      openWorker: (_f, options) => new Worker(workerPath, options),
    },
  });
  try {
    await db.connect({
      async fetchCredentials() {
        return bootstrap();
      },
      async uploadData() {},
    });
    await Promise.race([
      db.waitForFirstSync(),
      new Promise<void>((l) => setTimeout(l, 10_000)),
    ]);
    const fila = await db.getOptional<{ id: string }>('SELECT id FROM commits_prueba WHERE id = ?', [id]);
    return !!fila;
  } finally {
    try {
      await db.disconnect();
      await db.close();
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

async function contar(id: string): Promise<number> {
  const r = await pool.query('SELECT count(*)::int AS n FROM commits_prueba WHERE id = $1', [id]);
  return r.rows[0]?.n ?? 0;
}

async function esperarPostgres(id: string, mensaje: string, ms: number): Promise<boolean> {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    const r = await pool.query<{ mensaje: string }>(
      'SELECT mensaje FROM commits_prueba WHERE id = $1',
      [id],
    );
    if (r.rows[0]?.mensaje === mensaje) return true;
    await pausa(400);
  }
  return false;
}

async function esperar(condicion: () => Promise<boolean>, ms: number): Promise<boolean> {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (await condicion()) return true;
    await pausa(500);
  }
  return false;
}

function reportar(nombre: string, ok: boolean, detalle: unknown): void {
  if (!ok) fallos += 1;
  console.info(ok ? `✓ ${nombre}` : `✗ ${nombre}`, detalle);
}

function nuevoId(prefijo: string): string {
  return `cmt_pdc_r6_${prefijo}_${Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;
}

function pausa(ms: number): Promise<void> {
  return new Promise((l) => setTimeout(l, ms));
}

function obligatorio(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`falta ${nombre}`);
  return valor;
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
