/**
 * Tubería de una publicación: variante → escritura → git (H5 / P8).
 * No toca el tablero Yjs. El estado en réplica/UI lo maneja la acción.
 *
 * Git va dentro del procesador de la cola: solo entonces el job queda
 * `publicado` (si git fallara después, la cola mentiría `publicado`).
 */

import path from 'node:path';

import type { IdentificadorDeCommit, IdentificadorDeSala, VinculoSalaRepo } from '@harukoia/domain';

import type { AlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import { abrirColaDePublicacion } from '../cola-de-publicacion/cola-de-publicacion.ts';
import { escribirArtefactosEnCheckout } from '../escritura/escribir-artefactos.ts';
import type { OpcionesDePublicacionGit, ResultadoDePublicacionGit } from '../git/publicar-en-git.ts';
import { publicarEnGit } from '../git/publicar-en-git.ts';
import { crearProcesadorDesdeRegistro } from '../mecanismo/orquestar-publicacion.ts';
import { crearRegistroDeVariantes } from '../mecanismo/registro-de-variantes.ts';
import { crearVarianteMarkdownDeterminista } from '../variantes/markdown-determinista/markdown-determinista.ts';

export type ResultadoDeCorrerPublicacion =
  | { readonly ok: true; readonly rutas: readonly string[]; readonly commitGit: string }
  | { readonly ok: false; readonly causa: string };

export type DependenciasDeCorrerPublicacion = {
  readonly sala: IdentificadorDeSala;
  readonly almacen: AlmacenDeCommits;
  readonly vinculo: VinculoSalaRepo;
  readonly archivoDeCola: string;
  /** Inyectable en pruebas (fallo o bare local). */
  readonly publicarEnGit?: (
    opciones: OpcionesDePublicacionGit,
  ) => Promise<ResultadoDePublicacionGit>;
  /** Si está definido, la tubería falla con esta causa (palanca de prueba). */
  readonly falloInyectado?: string;
};

export async function correrPublicacion(
  commitId: IdentificadorDeCommit,
  deps: DependenciasDeCorrerPublicacion,
): Promise<ResultadoDeCorrerPublicacion> {
  if (deps.falloInyectado !== undefined && deps.falloInyectado.trim() !== '') {
    return { ok: false, causa: deps.falloInyectado.trim() };
  }

  const snap = await deps.almacen.leerSnapshot(commitId);
  if (snap === null) {
    return { ok: false, causa: 'commit-inexistente' };
  }

  const historial = await deps.almacen.listarHistorial(deps.sala);
  const commit = historial.find((c) => c.id === commitId);
  if (commit === undefined) {
    return { ok: false, causa: 'commit-inexistente' };
  }

  let rutasEscritas: string[] = [];
  let commitGit = '';
  const gitFn = deps.publicarEnGit ?? publicarEnGit;
  const registro = crearRegistroDeVariantes([crearVarianteMarkdownDeterminista()]);
  const procesador = crearProcesadorDesdeRegistro(
    registro,
    async () => ({
      ok: true as const,
      entrada: {
        commit: {
          id: commit.id,
          mensaje: commit.mensaje,
          autor: commit.autor,
          participantes: commit.participantes,
          creadoEn: commit.creadoEn,
        },
        tablero: snap.tablero,
      },
    }),
    async (artefactos) => {
      const escrito = escribirArtefactosEnCheckout(deps.vinculo.raizDelCheckout, artefactos);
      if (!escrito.ok) {
        return { ok: false, causa: escrito.causa };
      }
      rutasEscritas = [...escrito.escritas];
      const empujado = await gitFn({
        raizDelCheckout: deps.vinculo.raizDelCheckout,
        rutasRelativas: rutasEscritas,
        mensaje: `harukoia: publicar ${commitId}`,
      });
      if (!empujado.ok) {
        return { ok: false, causa: empujado.causa };
      }
      commitGit = empujado.commitGit;
      return { ok: true };
    },
  );

  const cola = abrirColaDePublicacion(deps.archivoDeCola);
  const encolado = cola.encolar(commitId, { variante: 'markdown-determinista' });
  if (!encolado.ok) {
    if (encolado.causa === 'ya-publicado') {
      return { ok: false, causa: 'ya-publicado' };
    }
    if (encolado.causa === 'ya-encolado') {
      return { ok: false, causa: 'publicacion-en-curso' };
    }
    return { ok: false, causa: encolado.causa };
  }

  const procesado = await cola.procesarSiguiente(procesador);
  if (!procesado.ok) {
    return { ok: false, causa: procesado.causa };
  }

  return { ok: true, rutas: rutasEscritas, commitGit };
}

export function archivoDeColaPorDefecto(raizDelCheckout: string): string {
  return path.join(raizDelCheckout, 'data', 'cola-publicacion.json');
}
