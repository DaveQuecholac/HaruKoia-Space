/**
 * Invocación del CLI `git` desde el cwd del comando (H5 / P9).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ResultadoDeGit = {
  readonly codigo: number;
  readonly stdout: string;
  readonly stderr: string;
};

export async function ejecutarGit(
  cwd: string,
  args: readonly string[],
): Promise<ResultadoDeGit> {
  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd,
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

export async function esRepositorioGit(cwd: string): Promise<boolean> {
  const r = await ejecutarGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return r.codigo === 0 && r.stdout.trim() === 'true';
}

/**
 * Raíz del working tree git (D-H5-4): donde viven `Harukoia/Pizarra/…`.
 * Desde un subdirectorio sube al toplevel del repo.
 */
export async function raizDelRepositorioGit(cwd: string): Promise<string | null> {
  const r = await ejecutarGit(cwd, ['rev-parse', '--show-toplevel']);
  if (r.codigo !== 0) return null;
  const raiz = r.stdout.trim();
  return raiz === '' ? null : raiz;
}
