/**
 * `space host` — arranca el contenedor host desde este checkout (H5 / P9 / D-H5-4).
 * Fuera de un repo git → error claro.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { esRepositorioGit } from '../../git/ejecutar-git.ts';

export type ResultadoDeHost = {
  readonly codigo: number;
  readonly texto: string;
};

export type DependenciasDeHost = {
  readonly cwd?: string;
  /** Inyectable en pruebas: no lanza el proceso real. */
  readonly arrancar?: (opts: {
    readonly cwd: string;
    readonly entradaDelHost: string;
  }) => Promise<ResultadoDeHost>;
};

function rutaDelMainDelHost(): string {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  // apps/cli/src/comandos/host → apps/host/src/main.ts
  return path.resolve(aqui, '../../../../host/src/main.ts');
}

async function arrancarHostPorDefecto(opts: {
  readonly cwd: string;
  readonly entradaDelHost: string;
}): Promise<ResultadoDeHost> {
  if (!fs.existsSync(opts.entradaDelHost)) {
    return {
      codigo: 1,
      texto: `No se encontró el host en ${opts.entradaDelHost}. ¿Está instalado el paquete @harukoia/host?\n`,
    };
  }

  return await new Promise<ResultadoDeHost>((resolver) => {
    const hijo: ChildProcess = spawn(process.execPath, [opts.entradaDelHost], {
      cwd: opts.cwd,
      env: process.env,
      stdio: 'inherit',
    });

    hijo.on('error', (error) => {
      resolver({
        codigo: 1,
        texto: `No se pudo arrancar el host: ${error.message}\n`,
      });
    });

    hijo.on('exit', (code, signal) => {
      if (signal) {
        resolver({ codigo: 1, texto: `Host terminado por señal ${signal}.\n` });
        return;
      }
      resolver({
        codigo: code ?? 1,
        texto: code === 0 ? 'Host detenido.\n' : `Host salió con código ${code ?? 1}.\n`,
      });
    });
  });
}

export async function correrHost(deps: DependenciasDeHost = {}): Promise<ResultadoDeHost> {
  const cwd = deps.cwd ?? process.cwd();

  if (!(await esRepositorioGit(cwd))) {
    return {
      codigo: 1,
      texto:
        'No es un repositorio git. Ejecuta `space host` dentro del checkout del proyecto (D-H5-4).\n',
    };
  }

  const entradaDelHost = rutaDelMainDelHost();
  const arrancar = deps.arrancar ?? arrancarHostPorDefecto;

  process.stdout.write(
    `Arrancando host con checkout ${cwd}\n(sala↔repo = este directorio)\n`,
  );

  return arrancar({ cwd, entradaDelHost });
}
