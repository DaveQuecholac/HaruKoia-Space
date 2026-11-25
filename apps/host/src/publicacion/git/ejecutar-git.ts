/**
 * Invocación del CLI `git` en un working tree (H5 / P7).
 * Sin red externa: los tests usan remoto bare local.
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
  opciones?: { readonly env?: NodeJS.ProcessEnv },
): Promise<ResultadoDeGit> {
  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd,
      env: { ...process.env, ...opciones?.env },
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
