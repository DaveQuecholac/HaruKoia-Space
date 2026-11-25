/**
 * Commit + push de generados al remoto del checkout (H5 / P7 / H5-T9).
 *
 * Solo rutas bajo `harukoia/publicado/…`. Si el remoto adelantó: fetch, merge,
 * en conflictos de generados gana el generado local (commit nuevo); reintenta push.
 */

import { PREFIJO_PUBLICADO, comoRutaPublicada } from '@harukoia/domain';

import { esRechazoPorRemotoAdelantado, ejecutarGit } from './ejecutar-git.ts';

export type OpcionesDePublicacionGit = {
  readonly raizDelCheckout: string;
  /** Rutas relativas ya escritas (P6), bajo el prefijo publicado. */
  readonly rutasRelativas: readonly string[];
  readonly mensaje: string;
  readonly remoto?: string;
  /** Intentos de push tras integrar remoto (default 2 = 1 reintento). */
  readonly maxIntentosPush?: number;
};

export type ResultadoDePublicacionGit =
  | { readonly ok: true; readonly commitGit: string; readonly rama: string }
  | { readonly ok: false; readonly causa: string };

async function ramaActual(cwd: string): Promise<string | null> {
  const r = await ejecutarGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (r.codigo !== 0) return null;
  const rama = r.stdout.trim();
  return rama === '' || rama === 'HEAD' ? null : rama;
}

async function hayConflictos(cwd: string): Promise<readonly string[]> {
  const r = await ejecutarGit(cwd, ['diff', '--name-only', '--diff-filter=U']);
  if (r.codigo !== 0) return [];
  return r.stdout
    .split('\n')
    .map((l) => l.trim().replaceAll('\\', '/'))
    .filter((l) => l !== '');
}

async function resolverConflictosDeGenerados(cwd: string): Promise<ResultadoDePublicacionGit | null> {
  const conflictos = await hayConflictos(cwd);
  for (const archivo of conflictos) {
    if (archivo !== PREFIJO_PUBLICADO && !archivo.startsWith(`${PREFIJO_PUBLICADO}/`)) {
      return { ok: false, causa: `conflicto-fuera-de-generados:${archivo}` };
    }
    const ours = await ejecutarGit(cwd, ['checkout', '--ours', '--', archivo]);
    if (ours.codigo !== 0) {
      return { ok: false, causa: `no-se-pudo-tomar-generado-local:${archivo}` };
    }
    const add = await ejecutarGit(cwd, ['add', '--', archivo]);
    if (add.codigo !== 0) {
      return { ok: false, causa: `no-se-pudo-agregar-tras-conflicto:${archivo}` };
    }
  }
  return null;
}

async function integrarRemotoAdelantado(
  cwd: string,
  remoto: string,
  rama: string,
): Promise<ResultadoDePublicacionGit | null> {
  const fetch = await ejecutarGit(cwd, ['fetch', remoto, rama]);
  if (fetch.codigo !== 0) {
    return {
      ok: false,
      causa: `fetch-fallo:${fetch.stderr.trim() || fetch.stdout.trim() || 'desconocido'}`,
    };
  }

  const merge = await ejecutarGit(cwd, [
    'merge',
    '--no-edit',
    `${remoto}/${rama}`,
    '-m',
    'harukoia: integrar remoto adelantado antes de publicar',
  ]);

  if (merge.codigo !== 0) {
    const fallo = await resolverConflictosDeGenerados(cwd);
    if (fallo) return fallo;

    const quedan = await hayConflictos(cwd);
    if (quedan.length > 0) {
      await ejecutarGit(cwd, ['merge', '--abort']);
      return { ok: false, causa: `conflictos-sin-resolver:${quedan.join(',')}` };
    }

    const commitMerge = await ejecutarGit(cwd, [
      'commit',
      '--no-edit',
      '-m',
      'harukoia: integrar remoto adelantado antes de publicar',
    ]);
    if (commitMerge.codigo !== 0) {
      // Puede que el merge ya haya quedado listo sin commit pendiente.
      const mergeHead = await ejecutarGit(cwd, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
      if (mergeHead.codigo === 0) {
        return {
          ok: false,
          causa: `merge-commit-fallo:${commitMerge.stderr.trim() || 'desconocido'}`,
        };
      }
    }
  }

  return null;
}

export async function publicarEnGit(
  opciones: OpcionesDePublicacionGit,
): Promise<ResultadoDePublicacionGit> {
  const cwd = opciones.raizDelCheckout;
  const remoto = opciones.remoto ?? 'origin';
  const maxIntentos = opciones.maxIntentosPush ?? 2;

  if (opciones.rutasRelativas.length === 0) {
    return { ok: false, causa: 'sin-rutas' };
  }
  if (typeof opciones.mensaje !== 'string' || opciones.mensaje.trim() === '') {
    return { ok: false, causa: 'mensaje-vacio' };
  }

  for (const relativa of opciones.rutasRelativas) {
    const validada = comoRutaPublicada(relativa);
    if (!validada.ok) {
      return { ok: false, causa: `ruta-invalida:${relativa}` };
    }
  }

  const dentro = await ejecutarGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (dentro.codigo !== 0 || dentro.stdout.trim() !== 'true') {
    return { ok: false, causa: 'sin-checkout-git' };
  }

  const urlRemoto = await ejecutarGit(cwd, ['remote', 'get-url', remoto]);
  if (urlRemoto.codigo !== 0) {
    return { ok: false, causa: 'sin-remoto' };
  }

  const rama = await ramaActual(cwd);
  if (rama === null) {
    return { ok: false, causa: 'rama-indeterminada' };
  }

  const add = await ejecutarGit(cwd, ['add', '--', ...opciones.rutasRelativas]);
  if (add.codigo !== 0) {
    return { ok: false, causa: `git-add-fallo:${add.stderr.trim() || 'desconocido'}` };
  }

  const estado = await ejecutarGit(cwd, ['status', '--porcelain', '--', ...opciones.rutasRelativas]);
  const hayCambios = estado.stdout.trim() !== '';
  // También staged-only: status porcelain muestra staged.
  // Si no hay cambios respecto a HEAD, no hacemos commit vacío.
  if (hayCambios) {
    const commit = await ejecutarGit(cwd, ['commit', '-m', opciones.mensaje.trim()]);
    if (commit.codigo !== 0) {
      return { ok: false, causa: `git-commit-fallo:${commit.stderr.trim() || 'desconocido'}` };
    }
  }

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    const push = await ejecutarGit(cwd, ['push', remoto, rama]);
    if (push.codigo === 0) {
      const rev = await ejecutarGit(cwd, ['rev-parse', 'HEAD']);
      return {
        ok: true,
        commitGit: rev.stdout.trim(),
        rama,
      };
    }

    if (!esRechazoPorRemotoAdelantado(push)) {
      return {
        ok: false,
        causa: `git-push-fallo:${push.stderr.trim() || push.stdout.trim() || 'desconocido'}`,
      };
    }

    if (intento >= maxIntentos) {
      return { ok: false, causa: 'remoto-adelantado-sin-resolver' };
    }

    const integrado = await integrarRemotoAdelantado(cwd, remoto, rama);
    if (integrado) return integrado;
  }

  return { ok: false, causa: 'git-push-agotado' };
}
