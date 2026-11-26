/**
 * Invocación del CLI `git` en un working tree (H5 / P7).
 * Sin red externa: los tests usan remoto bare local.
 *
 * Los proxies hacia loopback (p. ej. el túnel del agente de Cursor) se
 * omiten: el host de PM2 no puede usarlos y rompen push/fetch a GitHub.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CLAVES_DE_PROXY = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
] as const;

export type ResultadoDeGit = {
  readonly codigo: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Quita proxies que apuntan a 127.0.0.1 / localhost / ::1. */
export function envSinProxyDeLoopback(
  base: NodeJS.ProcessEnv,
  extra?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, ...extra };
  for (const clave of CLAVES_DE_PROXY) {
    const valor = env[clave];
    if (typeof valor === 'string' && /127\.0\.0\.1|localhost|\[::1\]/i.test(valor)) {
      delete env[clave];
    }
  }
  return env;
}

export async function ejecutarGit(
  cwd: string,
  args: readonly string[],
  opciones?: { readonly env?: NodeJS.ProcessEnv },
): Promise<ResultadoDeGit> {
  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd,
      env: envSinProxyDeLoopback(process.env, opciones?.env),
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    return { codigo: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (error) {
    const err = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      codigo: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? 'git-fallo',
    };
  }
}

export function esRechazoPorRemotoAdelantado(resultado: ResultadoDeGit): boolean {
  const texto = `${resultado.stdout}\n${resultado.stderr}`.toLowerCase();
  return (
    texto.includes('non-fast-forward') ||
    texto.includes('[rejected]') ||
    texto.includes('fetch first') ||
    texto.includes('tip of your current branch is behind')
  );
}

/**
 * Raíz del working tree git (D-H5-4): donde van `Harukoia/Pizarra/…`.
 * Desde un subdirectorio (p. ej. apps/host) sube al toplevel del repo.
 */
export async function raizDelRepositorioGit(cwd: string): Promise<string | null> {
  const r = await ejecutarGit(cwd, ['rev-parse', '--show-toplevel']);
  if (r.codigo !== 0) return null;
  const raiz = r.stdout.trim();
  return raiz === '' ? null : raiz;
}
