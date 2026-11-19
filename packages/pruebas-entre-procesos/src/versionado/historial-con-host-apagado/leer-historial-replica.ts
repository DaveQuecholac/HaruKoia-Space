/**
 * V7 — Lector de historial por PowerSync (producto).
 * No usa orquestador ni relay. No necesita el host encendido (criterio H4-T9 / PdC 4).
 *
 * Uso:
 *   SALA_LECTURA=<sala> pnpm --filter @harukoia/pruebas-entre-procesos humo:v7
 * Env (apps/backend-escritura/.env o export):
 *   BACKEND_ESCRITURA_URL, POWERSYNC_PUBLIC_URL, SALA_LECTURA
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

import { PowerSyncDatabase } from '@powersync/node';

import { esquemaClienteDeReplica } from './esquema-cliente-replica.ts';

const raizPaquete = resolve(fileURLToPath(import.meta.url), '../../../..');
const raizRepo = resolve(raizPaquete, '../..');
const workerPath = resolve(raizPaquete, 'powersync.worker.cjs');

cargarEnvSiExiste(resolve(raizRepo, 'apps/backend-escritura/.env'));

const backendUrl = obligatorio('BACKEND_ESCRITURA_URL');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const sala =
  process.env.SALA_LECTURA?.trim() ||
  process.env.SALA_DEL_HOST?.trim() ||
  obligatorio('SALA_PRUEBA');

type FilaCommit = {
  readonly id: string;
  readonly mensaje: string;
  readonly autor: string;
  readonly creado_en: number;
  readonly padre: string | null;
};

async function conTope<T>(etiqueta: string, ms: number, tarea: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tarea,
      new Promise<T>((_, rechazo) => {
        timer = setTimeout(() => rechazo(new Error(`tope ${ms}ms en ${etiqueta}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function abrirLector(etiqueta: string, salaDelToken: string): Promise<PowerSyncDatabase> {
  const dir = resolve(raizPaquete, 'tmp', `lector-v7-${etiqueta}-${randomBytes(3).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const db = new PowerSyncDatabase({
    schema: esquemaClienteDeReplica,
    database: {
      dbFilename: 'lector.db',
      dbLocation: dir,
      openWorker: (_factoryPath, options) => new Worker(workerPath, options),
    },
  });
  (db as unknown as { __dirLector?: string }).__dirLector = dir;

  await conTope(
    `connect:${etiqueta}`,
    20_000,
    db.connect({
      async fetchCredentials() {
        const res = await fetch(
          `${backendUrl}/sync/bootstrap?sala=${encodeURIComponent(salaDelToken)}`,
        );
        if (!res.ok) throw new Error(`bootstrap ${res.status}`);
        const cuerpo = (await res.json()) as { powersyncUrl: string; token: string };
        return { endpoint: cuerpo.powersyncUrl || powersyncUrl, token: cuerpo.token };
      },
      async uploadData() {
        /* solo lectura */
      },
    }),
  );

  await Promise.race([
    db.waitForFirstSync(),
    new Promise<void>((listo) => setTimeout(listo, 8_000)),
  ]);
  return db;
}

async function cerrar(db: PowerSyncDatabase): Promise<void> {
  const dir = (db as unknown as { __dirLector?: string }).__dirLector;
  try {
    await db.disconnect();
    await db.close();
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.info('lector-v7', { backendUrl, powersyncUrl, sala });
  console.info('host no requerido: lectura solo vía PowerSync');

  const bueno = await abrirLector('ok', sala);
  let filas: FilaCommit[] = [];
  try {
    filas = (await bueno.getAll(
      `SELECT id, mensaje, autor, creado_en, padre
       FROM commits
       WHERE sala = ? AND borrado = 0
       ORDER BY creado_en DESC`,
      [sala],
    )) as FilaCommit[];

    if (filas.length === 0) {
      console.error('no se vio ningún commit con el JWT de la sala', { sala });
      process.exit(1);
    }

    console.info('historial vía réplica', { cuantos: filas.length });
    for (const f of filas.slice(0, 10)) {
      console.info('  ', {
        id: f.id,
        mensaje: f.mensaje || '(sin mensaje)',
        autor: f.autor,
        creado_en: f.creado_en,
      });
    }

    const conSnap = await bueno.getOptional<{ id: string; tablero_json: string }>(
      `SELECT id, tablero_json FROM snapshots WHERE id = ? AND borrado = 0`,
      [filas[0]!.id],
    );
    if (!conSnap) {
      console.error('el commit más reciente no tiene snapshot en la réplica', { id: filas[0]!.id });
      process.exit(1);
    }
    console.info('snapshot ok', { id: conSnap.id, tablero_json: conSnap.tablero_json.slice(0, 48) });
  } finally {
    await cerrar(bueno);
  }

  const malo = await abrirLector('otra', 'salaajenahostapag001');
  try {
    const colada = await malo.getOptional<{ id: string }>(
      'SELECT id FROM commits WHERE id = ?',
      [filas[0]!.id],
    );
    if (colada) {
      console.error('F-R6 falló: JWT de otra sala vio el commit', colada);
      process.exit(1);
    }
    console.info('F-R6 ok: JWT de otra sala no ve el commit');
  } finally {
    await cerrar(malo);
  }

  console.info('ok: V7 — historial legible sin host (PowerSync) + F-R6');
}

function cargarEnvSiExiste(ruta: string): void {
  if (!existsSync(ruta)) return;
  for (const line of readFileSync(ruta, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep === -1) continue;
    const clave = trimmed.slice(0, sep).trim();
    const valor = trimmed.slice(sep + 1).trim();
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

function obligatorio(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`falta ${nombre}`);
  return valor;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
