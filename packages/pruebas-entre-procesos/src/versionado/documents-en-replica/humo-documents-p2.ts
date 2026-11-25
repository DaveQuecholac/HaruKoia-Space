/**
 * H5 P2 — Humo: host escribe document vía backend; lector PowerSync lo ve sin relay.
 *
 *   pnpm --filter @harukoia/pruebas-entre-procesos humo:p2
 *
 * Requiere: réplica (Postgres+PowerSync), backend-escritura, tabla documents aplicada.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

import { PowerSyncDatabase } from '@powersync/node';

import { esquemaClienteDeReplica } from '../historial-con-host-apagado/esquema-cliente-replica.ts';

const raizPaquete = resolve(fileURLToPath(import.meta.url), '../../../..');
const raizRepo = resolve(raizPaquete, '../..');
const workerPath = resolve(raizPaquete, 'powersync.worker.cjs');

cargarEnvSiExiste(resolve(raizRepo, 'apps/backend-escritura/.env'));
cargarEnvSiExiste(resolve(raizRepo, 'pruebas/replica-central/.env'));

const backendUrl = obligatorio('BACKEND_ESCRITURA_URL');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const sala = obligatorio('SALA_DEL_HOST');
const tokenDeHost = obligatorio('TOKEN_DE_HOST');

const idDoc = `p2doc${randomBytes(6).toString('hex')}`.slice(0, 16);
const idCommit = `p2cmt${randomBytes(6).toString('hex')}`.slice(0, 16);

async function main(): Promise<void> {
  const batch = [
    {
      op: 'PUT',
      table: 'documents',
      id: idDoc,
      data: {
        sala,
        commit_id: idCommit,
        variante: 'markdown-determinista',
        estado_tipo: 'en-proceso',
        estado_causa: null,
        estado_marca: null,
        ruta_directorio: `Harukoia/Pizarra/2026-11-25_1200__humo__p2__${idCommit.slice(0, 8)}`,
        ruta_tablero_json: `Harukoia/Pizarra/2026-11-25_1200__humo__p2__${idCommit.slice(0, 8)}/tablero.json`,
        ruta_documento_markdown: `Harukoia/Pizarra/2026-11-25_1200__humo__p2__${idCommit.slice(0, 8)}/documento.md`,
        creado_en: Date.now(),
        actualizado_en: Date.now(),
        borrado: false,
      },
    },
  ];

  const res = await fetch(`${backendUrl}/api/data`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenDeHost}`,
    },
    body: JSON.stringify({ sala, batch }),
  });
  const cuerpo = (await res.json()) as { ok?: boolean; causa?: string; aplicadas?: number };
  if (!cuerpo.ok) {
    throw new Error(`escritura falló: ${cuerpo.causa ?? res.status}`);
  }
  console.log('escritura ok', { idDoc, aplicadas: cuerpo.aplicadas });

  const malo = await fetch(`${backendUrl}/api/data`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-inventado',
    },
    body: JSON.stringify({ sala, batch }),
  });
  const rechazo = (await malo.json()) as { ok?: boolean; causa?: string };
  if (rechazo.ok !== false || rechazo.causa !== 'host-no-autorizado') {
    throw new Error(`se esperaba host-no-autorizado, llegó ${JSON.stringify(rechazo)}`);
  }
  console.log('rechazo sin token de host ok');

  const dir = resolve(raizPaquete, 'tmp', `lector-p2-${randomBytes(3).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const db = new PowerSyncDatabase({
    schema: esquemaClienteDeReplica,
    database: {
      dbFilename: 'lector.db',
      dbLocation: dir,
      openWorker: (_factoryPath, options) => new Worker(workerPath, options),
    },
  });

  try {
    await db.connect({
      async fetchCredentials() {
        const boot = await fetch(`${backendUrl}/sync/bootstrap?sala=${encodeURIComponent(sala)}`);
        if (!boot.ok) throw new Error(`bootstrap ${boot.status}`);
        const j = (await boot.json()) as { powersyncUrl: string; token: string };
        return { endpoint: j.powersyncUrl || powersyncUrl, token: j.token };
      },
      async uploadData() {
        /* solo lectura */
      },
    });
    await Promise.race([
      db.waitForFirstSync(),
      new Promise<void>((listo) => setTimeout(listo, 12_000)),
    ]);

    let visto: unknown[] = [];
    const limite = Date.now() + 20_000;
    while (Date.now() < limite) {
      visto = await db.getAll(
        `SELECT id, commit_id, estado_tipo, ruta_documento_markdown FROM documents WHERE id = ?`,
        [idDoc],
      );
      if (visto.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (visto.length === 0) {
      throw new Error('lector PowerSync no vio el document (¿sync-config / tabla aplicadas?)');
    }
    console.log('lectura PowerSync ok', visto[0]);
    console.log('P2 humo verde (sin orquestador ni host de producto)');
  } finally {
    try {
      await db.disconnect();
      await db.close();
    } catch {
      /* */
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function obligatorio(nombre: string): string {
  const v = process.env[nombre]?.trim();
  if (!v) throw new Error(`falta ${nombre}`);
  return v;
}

function cargarEnvSiExiste(ruta: string): void {
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
