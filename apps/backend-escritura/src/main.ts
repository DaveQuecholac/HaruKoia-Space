/**
 * Backend de escritura de la réplica central (producto, V6).
 * Solo el host alimenta Postgres. No es el orquestador.
 *
 * POST /api/data          cola de subida (batch). Token de host.
 * GET  /sync/bootstrap    JWT de lectura + URL de PowerSync (D-R3).
 * GET  /health
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import { emitirTokenDeLectura } from './emitir-jwt/emitir-jwt.ts';
import { escribirBatch, type OperacionDeCola } from './escribir-batch/escribir-batch.ts';
import { validarHost } from './validar-host/validar-host.ts';

const sala = obligatorio('SALA_DEL_HOST');
const tokenDeHost = obligatorio('TOKEN_DE_HOST');
const databaseUrl = obligatorio('DATABASE_URL');
const powersyncUrl = obligatorio('POWERSYNC_PUBLIC_URL');
const puerto = Number(process.env.BACKEND_ESCRITURA_PORT ?? '18091');
const rutaClave = resolve(
  process.cwd(),
  process.env.SYNC_JWT_PRIVATE_KEY_PATH ?? '../../pruebas/replica-central/keys/local-dev.pem',
);
const kid = process.env.SYNC_JWT_KID ?? 'harukoia-pdc-local-1';
const audience = process.env.SYNC_JWT_AUDIENCE ?? 'powersync-dev';

const pool = new Pool({ connectionString: databaseUrl });

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, servicio: 'backend-escritura' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/sync/bootstrap') {
      const salaDelToken = url.searchParams.get('sala')?.trim() || sala;
      const token = await emitirTokenDeLectura({
        rutaClavePrivada: rutaClave,
        kid,
        audience,
        sala: salaDelToken,
      });
      json(res, 200, { powersyncUrl, token, sala: salaDelToken });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/data') {
      await atenderSubida(req, res);
      return;
    }
    json(res, 404, { ok: false, causa: 'ruta-desconocida' });
  } catch (error) {
    const causa = error instanceof Error ? error.message : String(error);
    console.error('error', causa);
    json(res, 503, { ok: false, causa });
  }
});

async function atenderSubida(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cuerpo = await leerJson(req);
  const presentado = {
    sala: String(cuerpo.sala ?? ''),
    tokenDeHost: tokenDesdeAuthorization(req.headers.authorization) ?? String(cuerpo.tokenDeHost ?? ''),
  };
  const validacion = validarHost(presentado, { sala, tokenDeHost });
  if (!validacion.ok) {
    console.warn('rechazo', validacion.causa, { sala: presentado.sala || '(vacía)' });
    json(res, 200, { ok: false, causa: validacion.causa });
    return;
  }

  const batch = Array.isArray(cuerpo.batch) ? (cuerpo.batch as OperacionDeCola[]) : [];
  const resultado = await escribirBatch(pool, sala, batch);
  if (!resultado.ok) {
    const temporal = resultado.causa.startsWith('postgres:');
    console.warn('escritura', resultado.causa);
    if (temporal) {
      json(res, 503, resultado);
      return;
    }
    json(res, 200, resultado);
    return;
  }
  console.info('aceptada', { aplicadas: resultado.aplicadas });
  json(res, 200, resultado);
}

function tokenDesdeAuthorization(valor: string | string[] | undefined): string | undefined {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto?.startsWith('Bearer ')) return undefined;
  return texto.slice('Bearer '.length).trim() || undefined;
}

function leerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((listo, fallo) => {
    const trozos: Buffer[] = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(trozos).toString('utf8') || '{}';
        listo(JSON.parse(raw) as Record<string, unknown>);
      } catch (error) {
        fallo(error);
      }
    });
    req.on('error', fallo);
  });
}

function json(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function obligatorio(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`falta ${nombre} en el entorno`);
  return valor;
}

servidor.listen(puerto, '127.0.0.1', () => {
  console.info(`backend-escritura escuchando en http://127.0.0.1:${puerto}`, { sala });
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    servidor.close();
    await pool.end();
    process.exit(0);
  });
}
