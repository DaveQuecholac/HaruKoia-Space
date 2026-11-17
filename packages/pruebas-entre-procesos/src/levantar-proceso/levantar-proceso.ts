import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ProcesoLevantado = {
  readonly proceso: ChildProcess;
  readonly url: string;
  /** Todo lo que el proceso escribió hasta ahora, salida y errores juntos. */
  readonly salida: () => string;
  /** SQLite de este host. El segundo arranque de la misma sala lo vuelve a pasar. */
  readonly archivoSqlite?: string;
  /** Cuenta del keyring de este host. El segundo arranque usa la misma. */
  readonly cuentaIdentidad?: string;
};

const levantados: ProcesoLevantado[] = [];
const directoriosTemporales: string[] = [];
let cuentasDePrueba = 0;

/**
 * Lanza un proceso del motor y lee de su salida el puerto en que quedó
 * escuchando. Por defecto con puerto cero, así dos corridas no chocan.
 *
 * `rutaDelMain` es relativa a la raíz del monorepo.
 */
export function levantar(
  rutaDelMain: string,
  entorno: Record<string, string> = {},
  espera = 15_000,
): Promise<ProcesoLevantado> {
  const main = fileURLToPath(new URL(`../../../../${rutaDelMain}`, import.meta.url));
  const preparado = entornoDelProceso(rutaDelMain, entorno);

  const proceso = spawn(process.execPath, [main], {
    env: preparado.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let salida = '';

  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => {
      proceso.kill('SIGKILL');
      rechazar(new Error(`${rutaDelMain} no anunció su puerto en ${espera} ms:\n${salida}`));
    }, espera);

    let anunciado = false;

    proceso.stdout.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
      if (anunciado) return;
      const puerto = /http:\/\/127\.0\.0\.1:(\d+)/.exec(salida)?.[1];
      if (!puerto) return;

      anunciado = true;
      clearTimeout(limite);
      const levantado: ProcesoLevantado = {
        proceso,
        url: `http://127.0.0.1:${puerto}`,
        salida: () => salida,
        ...(preparado.archivoSqlite === undefined ? {} : { archivoSqlite: preparado.archivoSqlite }),
        ...(preparado.cuentaIdentidad === undefined ? {} : { cuentaIdentidad: preparado.cuentaIdentidad }),
      };
      levantados.push(levantado);
      resolver(levantado);
    });

    proceso.stderr.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
    });

    proceso.once('exit', (codigo) => {
      clearTimeout(limite);
      if (!anunciado) rechazar(new Error(`${rutaDelMain} terminó con código ${codigo}:\n${salida}`));
    });
  });
}

/** Apaga y espera la muerte real; si solo se manda la señal, quedan huérfanos. */
export function apagar(proceso: ChildProcess, espera = 5_000): Promise<void> {
  if (proceso.exitCode !== null || proceso.signalCode !== null) return Promise.resolve();

  return new Promise((listo) => {
    const rendirse = setTimeout(() => proceso.kill('SIGKILL'), espera);
    proceso.once('exit', () => {
      clearTimeout(rendirse);
      listo();
    });
    proceso.kill('SIGTERM');
  });
}

/** Para el `afterAll` de cada archivo de pruebas. */
export async function apagarTodos(): Promise<void> {
  await Promise.all(levantados.map(({ proceso }) => apagar(proceso)));
  levantados.length = 0;
  for (const directorio of directoriosTemporales.splice(0)) {
    rmSync(directorio, { recursive: true, force: true });
  }
}

/**
 * Cada host de prueba usa su propia cuenta del keyring. Si heredara la cuenta
 * del developer, el arranque de la prueba reemplazaría la sala real.
 */
function entornoDelProceso(
  rutaDelMain: string,
  entorno: Record<string, string>,
): { env: NodeJS.ProcessEnv; archivoSqlite?: string; cuentaIdentidad?: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: '0', HOST: '127.0.0.1', ...entorno };
  if (rutaDelMain !== 'apps/host/src/main.ts') return { env };

  let cuentaIdentidad = entorno.SALA_IDENTIDAD;
  if (cuentaIdentidad === undefined) {
    cuentasDePrueba += 1;
    cuentaIdentidad = `prueba-${process.pid}-${cuentasDePrueba}`;
    env.SALA_IDENTIDAD = cuentaIdentidad;
  }

  let archivoSqlite = entorno.SALA_SQLITE;
  if (archivoSqlite === undefined) {
    const directorio = mkdtempSync(path.join(tmpdir(), 'harukoia-sala-'));
    directoriosTemporales.push(directorio);
    archivoSqlite = path.join(directorio, 'sala.sqlite');
    env.SALA_SQLITE = archivoSqlite;
  }

  return { env, archivoSqlite, cuentaIdentidad };
}

/** Un puerto libre ahora mismo, para fijarle a un proceso que todavía no existe. */
export async function puertoLibre(): Promise<number> {
  const servidor = createServer();
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const { port } = servidor.address() as AddressInfo;
  await new Promise<void>((listo) => servidor.close(() => listo()));
  return port;
}

export async function esperarQue(condicion: () => boolean, limite = 10_000): Promise<void> {
  const inicio = Date.now();
  while (!condicion()) {
    if (Date.now() - inicio > limite) throw new Error('la condición no se cumplió a tiempo');
    await new Promise((listo) => setTimeout(listo, 25));
  }
}
