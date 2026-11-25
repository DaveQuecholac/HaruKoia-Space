/**
 * `space update` — materializa desde git (H5 / P9–P10 / D-H5-2).
 *
 * P10: idempotente. Si ya está al día con origin → exit 0, mensaje claro,
 * sin reescribir generados. Dos corridas seguidas no cambian `harukoia/publicado/`.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { PREFIJO_PUBLICADO } from '@harukoia/domain';

import { ejecutarGit, esRepositorioGit } from '../../git/ejecutar-git.ts';

export type ResultadoDeUpdate = {
  readonly codigo: number;
  readonly texto: string;
  /** true si no había nada que traer de origin. */
  readonly yaAlDia: boolean;
  /** Huella de archivos bajo harukoia/publicado/ (para pruebas de idempotencia). */
  readonly huellaDePublicados: string;
};

function listarPublicadosEnDisco(cwd: string): string[] {
  const raiz = path.join(cwd, ...PREFIJO_PUBLICADO.split('/'));
  if (!fs.existsSync(raiz)) return [];
  const out: string[] = [];
  const stack = [raiz];
  while (stack.length > 0) {
    const actual = stack.pop()!;
    for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
      const completa = path.join(actual, entrada.name);
      if (entrada.isDirectory()) stack.push(completa);
      else if (entrada.isFile()) out.push(completa);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'en'));
}

/** Hash estable del contenido de los generados en disco. */
export function huellaDePublicadosEnDisco(cwd: string): string {
  const hash = createHash('sha256');
  const raiz = path.join(cwd, ...PREFIJO_PUBLICADO.split('/'));
  for (const archivo of listarPublicadosEnDisco(cwd)) {
    const relativa = path.relative(raiz, archivo).split(path.sep).join('/');
    hash.update(relativa);
    hash.update('\0');
    hash.update(fs.readFileSync(archivo));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function textoConListado(prefijo: string, cwd: string): string {
  const listadoGit = /* sync helper via files on disk */ listarPublicadosEnDisco(cwd).map((a) =>
    path.relative(cwd, a).split(path.sep).join('/'),
  );
  const lineas = [
    prefijo,
    listadoGit.length === 0
      ? `Sin archivos bajo ${PREFIJO_PUBLICADO}/ en este working tree.`
      : `Publicados presentes (${listadoGit.length}):`,
    ...listadoGit.slice(0, 20).map((a) => `  ${a}`),
    listadoGit.length > 20 ? `  … y ${listadoGit.length - 20} más` : '',
    '',
  ].filter((l) => l !== '');
  return `${lineas.join('\n')}\n`;
}

export async function correrUpdate(cwd: string): Promise<ResultadoDeUpdate> {
  if (!(await esRepositorioGit(cwd))) {
    return {
      codigo: 1,
      texto: 'No es un repositorio git. Ejecuta space update dentro del checkout del proyecto.\n',
      yaAlDia: false,
      huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    };
  }

  const remoto = await ejecutarGit(cwd, ['remote', 'get-url', 'origin']);
  if (remoto.codigo !== 0) {
    return {
      codigo: 1,
      texto: 'Sin remoto "origin" configurado.\n',
      yaAlDia: false,
      huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    };
  }

  const rama = await ejecutarGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (rama.codigo !== 0 || rama.stdout.trim() === '' || rama.stdout.trim() === 'HEAD') {
    return {
      codigo: 1,
      texto: 'No se pudo determinar la rama actual.\n',
      yaAlDia: false,
      huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    };
  }
  const nombreRama = rama.stdout.trim();

  const fetch = await ejecutarGit(cwd, ['fetch', 'origin', nombreRama]);
  if (fetch.codigo !== 0) {
    return {
      codigo: 1,
      texto: `No se pudo hacer fetch de origin/${nombreRama}: ${
        fetch.stderr.trim() || 'error de git'
      }\n`,
      yaAlDia: false,
      huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    };
  }

  const local = await ejecutarGit(cwd, ['rev-parse', 'HEAD']);
  const remotoRev = await ejecutarGit(cwd, ['rev-parse', `origin/${nombreRama}`]);
  if (local.codigo !== 0 || remotoRev.codigo !== 0) {
    return {
      codigo: 1,
      texto: `No se pudo comparar HEAD con origin/${nombreRama}.\n`,
      yaAlDia: false,
      huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    };
  }

  if (local.stdout.trim() === remotoRev.stdout.trim()) {
    const huella = huellaDePublicadosEnDisco(cwd);
    return {
      codigo: 0,
      yaAlDia: true,
      huellaDePublicados: huella,
      texto: textoConListado(
        `Ya al día con origin/${nombreRama}. Sin cambios; no se reescribieron generados.`,
        cwd,
      ),
    };
  }

  const pull = await ejecutarGit(cwd, ['pull', '--ff-only', 'origin', nombreRama]);
  if (pull.codigo !== 0) {
    const pull2 = await ejecutarGit(cwd, ['pull', 'origin', nombreRama]);
    if (pull2.codigo !== 0) {
      return {
        codigo: 1,
        texto: `No se pudo actualizar desde origin/${nombreRama}: ${
          pull2.stderr.trim() || pull.stderr.trim() || 'error de git'
        }\n`,
        yaAlDia: false,
        huellaDePublicados: huellaDePublicadosEnDisco(cwd),
      };
    }
  }

  return {
    codigo: 0,
    yaAlDia: false,
    huellaDePublicados: huellaDePublicadosEnDisco(cwd),
    texto: textoConListado(`Actualizado desde origin/${nombreRama}.`, cwd),
  };
}
