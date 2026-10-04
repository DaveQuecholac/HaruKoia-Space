import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

type ProcesoLevantado = {
  proceso: ChildProcess;
  url: string;
};

const levantados: ProcesoLevantado[] = [];

/**
 * Lanza un proceso del motor con puerto cero y lee de su salida el puerto que
 * el sistema le asignó. Así dos corridas simultáneas no chocan.
 */
function levantar(rutaRelativaDelMain: string, espera = 15_000): Promise<ProcesoLevantado> {
  const main = fileURLToPath(new URL(rutaRelativaDelMain, import.meta.url));

  const proceso = spawn(process.execPath, [main], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => {
      proceso.kill('SIGKILL');
      rechazar(new Error(`${rutaRelativaDelMain} no anunció su puerto en ${espera} ms`));
    }, espera);

    let salida = '';

    proceso.stdout.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
      const puerto = /http:\/\/127\.0\.0\.1:(\d+)/.exec(salida)?.[1];
      if (!puerto) return;

      clearTimeout(limite);
      const levantado = { proceso, url: `http://127.0.0.1:${puerto}` };
      levantados.push(levantado);
      resolver(levantado);
    });

    proceso.stderr.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
    });

    proceso.once('exit', (codigo) => {
      clearTimeout(limite);
      rechazar(new Error(`${rutaRelativaDelMain} terminó con código ${codigo}:\n${salida}`));
    });
  });
}

afterAll(async () => {
  // Esperar la muerte real: si solo se manda la señal, el worker de pruebas
  // termina antes y los procesos quedan huérfanos.
  await Promise.all(levantados.map(({ proceso }) => apagar(proceso)));
  levantados.length = 0;
});

function apagar(proceso: ChildProcess, espera = 5_000): Promise<void> {
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

describe('arranque de los procesos del motor', () => {
  it(
    'el orquestador y el host levantan a la vez y responden su estado',
    async () => {
      const orquestador = await levantar('../../../../apps/orchestrator/src/main.ts');
      const host = await levantar('../../../../apps/host/src/main.ts');

      expect(orquestador.url).not.toBe(host.url);

      const [estadoDelOrquestador, estadoDelHost] = await Promise.all([
        fetch(`${orquestador.url}/health`).then((r) => r.json()),
        fetch(`${host.url}/health`).then((r) => r.json()),
      ]);

      expect(estadoDelOrquestador).toEqual({ service: 'orchestrator', status: 'ok' });
      expect(estadoDelHost).toEqual({ service: 'host', status: 'ok' });
    },
    30_000,
  );
});
