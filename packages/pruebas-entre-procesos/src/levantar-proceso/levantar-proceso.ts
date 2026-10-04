import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

export type ProcesoLevantado = {
  readonly proceso: ChildProcess;
  readonly url: string;
  /** Todo lo que el proceso escribió hasta ahora, salida y errores juntos. */
  readonly salida: () => string;
};

const levantados: ProcesoLevantado[] = [];

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

  const proceso = spawn(process.execPath, [main], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', ...entorno },
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
      const levantado = { proceso, url: `http://127.0.0.1:${puerto}`, salida: () => salida };
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
