/**
 * `space status` — local vs remoto git (H5 / P9). Mínimo viable.
 */

import { ejecutarGit, esRepositorioGit } from '../../git/ejecutar-git.ts';

export type ResultadoDeStatus = {
  readonly codigo: number;
  readonly texto: string;
};

export async function correrStatus(cwd: string): Promise<ResultadoDeStatus> {
  if (!(await esRepositorioGit(cwd))) {
    return {
      codigo: 1,
      texto: 'No es un repositorio git. Ejecuta space status dentro del checkout del proyecto.\n',
    };
  }

  const rama = await ejecutarGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (rama.codigo !== 0 || rama.stdout.trim() === '' || rama.stdout.trim() === 'HEAD') {
    return { codigo: 1, texto: 'No se pudo determinar la rama actual.\n' };
  }
  const nombreRama = rama.stdout.trim();

  const remoto = await ejecutarGit(cwd, ['remote', 'get-url', 'origin']);
  if (remoto.codigo !== 0) {
    return {
      codigo: 1,
      texto: `Rama: ${nombreRama}\nSin remoto "origin" configurado.\n`,
    };
  }

  await ejecutarGit(cwd, ['fetch', 'origin', nombreRama]);

  const local = await ejecutarGit(cwd, ['rev-parse', 'HEAD']);
  const remotoRev = await ejecutarGit(cwd, ['rev-parse', `origin/${nombreRama}`]);
  if (local.codigo !== 0 || remotoRev.codigo !== 0) {
    return {
      codigo: 1,
      texto: `Rama: ${nombreRama}\nRemoto: ${remoto.stdout.trim()}\nNo se pudo comparar con origin/${nombreRama}.\n`,
    };
  }

  const conteo = await ejecutarGit(cwd, [
    'rev-list',
    '--left-right',
    '--count',
    `origin/${nombreRama}...HEAD`,
  ]);
  let atras = 0;
  let adelante = 0;
  if (conteo.codigo === 0) {
    const partes = conteo.stdout.trim().split(/\s+/);
    atras = Number(partes[0] ?? 0);
    adelante = Number(partes[1] ?? 0);
  }

  const publicado = await ejecutarGit(cwd, [
    'ls-tree',
    '-r',
    '--name-only',
    'HEAD',
    '--',
    'harukoia/publicado',
  ]);
  const archivos =
    publicado.codigo === 0 && publicado.stdout.trim() !== ''
      ? publicado.stdout.trim().split('\n').length
      : 0;

  const alDia =
    atras === 0 && adelante === 0
      ? 'al día con origin'
      : `origin adelante=${atras}, local adelante=${adelante}`;

  const texto = [
    `Rama: ${nombreRama}`,
    `Remoto: ${remoto.stdout.trim()}`,
    `HEAD local: ${local.stdout.trim().slice(0, 12)}`,
    `HEAD origin/${nombreRama}: ${remotoRev.stdout.trim().slice(0, 12)}`,
    `Estado: ${alDia}`,
    `Publicados en HEAD (harukoia/publicado): ${archivos} archivo(s)`,
    '',
  ].join('\n');

  return { codigo: 0, texto };
}
