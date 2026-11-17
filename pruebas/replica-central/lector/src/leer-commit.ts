/**
 * Lector de la PdC (R5): lee commits por PowerSync. No habla con el orquestador.
 * Criterios 3 y 4 + F-R6.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

import { PowerSyncDatabase } from '@powersync/node';

import { esquemaDePrueba } from './esquema.ts';

const raizPrueba = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workerPath = resolve(fileURLToPath(new URL('../powersync.worker.cjs', import.meta.url)));

const backendUrl = obligatorio('BACKEND_ESCRITURA_URL');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const sala = obligatorio('SALA_PRUEBA');
const commitId = process.env.COMMIT_ID?.trim() || '';

type Fila = {
  readonly id: string;
  readonly mensaje: string;
  readonly snapshot_b64: string;
  readonly tablero_json: string;
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
  const dir = resolve(raizPrueba, 'tmp', `lector-${etiqueta}-${randomBytes(3).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const db = new PowerSyncDatabase({
    schema: esquemaDePrueba,
    database: {
      dbFilename: 'lector.db',
      dbLocation: dir,
      openWorker: (_factoryPath, options) => new Worker(workerPath, options),
    },
  });
  (db as unknown as { __dirLector?: string }).__dirLector = dir;

  await conTope(`connect:${etiqueta}`, 20_000, db.connect({
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
  }));

  // Stream vacío (otra sala): waitForFirstSync puede no resolver → tope.
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
  console.info('lector', { backendUrl, powersyncUrl, sala, commitId: commitId || '(último de la sala)' });

  const bueno = await abrirLector('ok', sala);
  let fila: Fila | null = null;
  try {
    fila = commitId
      ? await bueno.getOptional<Fila>(
          'SELECT id, mensaje, snapshot_b64, tablero_json FROM commits_prueba WHERE id = ?',
          [commitId],
        )
      : await bueno.getOptional<Fila>(
          'SELECT id, mensaje, snapshot_b64, tablero_json FROM commits_prueba WHERE sala = ? ORDER BY actualizado_en DESC LIMIT 1',
          [sala],
        );

    if (!fila) {
      console.error('no se vio ningún commit con el JWT de la sala', { sala, commitId });
      process.exit(1);
    }
    console.info('visto con JWT bueno', {
      id: fila.id,
      mensaje: fila.mensaje,
      snapshot_b64: fila.snapshot_b64?.slice(0, 24),
      tablero_json: fila.tablero_json?.slice(0, 40),
    });
    console.info('host harness no requerido: lectura solo vía PowerSync (criterio 4)');
  } finally {
    await cerrar(bueno);
  }

  // F-R6 después de cerrar el lector bueno (un solo worker a la vez).
  const malo = await abrirLector('otra', 'sala-ajena-pdc-0001');
  try {
    const colada = await malo.getOptional<{ id: string }>(
      'SELECT id FROM commits_prueba WHERE id = ?',
      [fila!.id],
    );
    if (colada) {
      console.error('F-R6 falló: JWT de otra sala vio el commit', colada);
      process.exit(1);
    }
    console.info('F-R6 ok: JWT de otra sala no ve el commit', { id: fila!.id });
  } finally {
    await cerrar(malo);
  }

  console.info('ok: criterios 3 y 4 + F-R6');
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
