/**
 * Acciones `publicar` y `reintentar-publicacion` (H5 / P8).
 *
 * Disparan la tubería real (variante → disco → git). Actualizan `documents`
 * en el espejo y avisan `estado-de-push` en vivo. No tocan el tablero Yjs.
 */

import {
  type DocumentoPublicado,
  type EntradaDeEstadoDePush,
  type IdentificadorDeCommit,
  type IdentificadorDeSala,
  type PedidoDeAccion,
  type VinculoSalaRepo,
  crearDocumentoPublicado,
  comoIdentificadorDeCommit,
  rutasDePublicacionDelCommit,
} from '@harukoia/domain';

import {
  archivoDeColaPorDefecto,
  correrPublicacion,
  type DependenciasDeCorrerPublicacion,
} from '../../publicacion/correr-publicacion/correr-publicacion.ts';
import type { AlmacenDeCommits } from '../../versionado/almacen-de-commits/almacen-de-commits.ts';
import type { ContextoDeAccion, ManejadorDeAccion, ResultadoDeAccion } from '../acciones-de-sala.ts';

export type DependenciasDePublicar = {
  readonly sala: IdentificadorDeSala;
  readonly almacen: AlmacenDeCommits;
  readonly vinculo: VinculoSalaRepo;
  readonly archivoDeCola?: string;
  readonly publicarEnGit?: DependenciasDeCorrerPublicacion['publicarEnGit'];
  readonly falloInyectado?: string;
};

function aEntrada(documento: DocumentoPublicado): EntradaDeEstadoDePush {
  if (documento.estado.tipo === 'en-proceso') {
    return {
      documento: documento.id,
      commit: documento.commit,
      estadoTipo: 'en-proceso',
      causa: null,
      marca: null,
    };
  }
  if (documento.estado.tipo === 'publicado') {
    return {
      documento: documento.id,
      commit: documento.commit,
      estadoTipo: 'publicado',
      causa: null,
      marca: documento.estado.publicadoEn,
    };
  }
  return {
    documento: documento.id,
    commit: documento.commit,
    estadoTipo: 'fallido',
    causa: documento.estado.causa,
    marca: documento.estado.fallidoEn,
  };
}

function avisarEstado(contexto: ContextoDeAccion, documento: DocumentoPublicado): void {
  contexto.avisar({ tipo: 'estado-de-push', ...aEntrada(documento) });
}

async function persistirYAvisar(
  deps: DependenciasDePublicar,
  contexto: ContextoDeAccion,
  documento: DocumentoPublicado,
): Promise<boolean> {
  const guardado = await deps.almacen.guardarDocumento(documento);
  if (!guardado.ok) return false;
  avisarEstado(contexto, documento);
  return true;
}

export function publicar(deps: DependenciasDePublicar): ManejadorDeAccion {
  const archivoDeCola = deps.archivoDeCola ?? archivoDeColaPorDefecto(deps.vinculo.raizDelCheckout);

  return async (pedido: PedidoDeAccion, contexto: ContextoDeAccion): Promise<ResultadoDeAccion> => {
    if (pedido.accion !== 'publicar' && pedido.accion !== 'reintentar-publicacion') {
      return { ok: false, causa: 'publicacion-no-disponible' };
    }

    let commitId: IdentificadorDeCommit;
    try {
      commitId = comoIdentificadorDeCommit(pedido.id);
    } catch {
      return { ok: false, causa: 'commit-inexistente' };
    }

    const historial = await deps.almacen.listarHistorial(deps.sala);
    const commitMeta = historial.find((c) => c.id === commitId);
    if (commitMeta === undefined) {
      return { ok: false, causa: 'commit-inexistente' };
    }

    const existentes = await deps.almacen.listarDocumentos(deps.sala);
    const delCommit = existentes.filter((d) => d.commit === commitId);
    const enCurso = delCommit.find((d) => d.estado.tipo === 'en-proceso');
    if (enCurso) {
      return { ok: false, causa: 'publicacion-en-curso' };
    }
    const publicado = delCommit.find((d) => d.estado.tipo === 'publicado');
    if (publicado && pedido.accion === 'publicar') {
      return { ok: false, causa: 'ya-publicado' };
    }
    const fallido = delCommit.find((d) => d.estado.tipo === 'fallido');
    if (pedido.accion === 'reintentar-publicacion' && !fallido) {
      return { ok: false, causa: 'sin-fallido-para-reintentar' };
    }

    const ahora = Date.now();
    const rutas = rutasDePublicacionDelCommit({
      commit: commitId,
      creadoEn: commitMeta.creadoEn,
      autor: commitMeta.autor,
      mensaje: commitMeta.mensaje,
    });
    const base =
      pedido.accion === 'reintentar-publicacion' && fallido
        ? fallido
        : (() => {
            const creado = crearDocumentoPublicado({
              sala: deps.sala,
              commit: commitId,
              variante: 'markdown-determinista',
              estado: { tipo: 'en-proceso' },
              creadoEn: ahora,
              autor: commitMeta.autor,
              mensaje: commitMeta.mensaje,
              rutas,
            });
            if (!creado.ok) return null;
            return creado.documento;
          })();

    if (base === null) {
      return { ok: false, causa: 'publicacion-no-disponible' };
    }

    const enProceso: DocumentoPublicado = {
      ...base,
      estado: { tipo: 'en-proceso' },
    };
    if (!(await persistirYAvisar(deps, contexto, enProceso))) {
      return { ok: false, causa: 'publicacion-no-disponible' };
    }

    const resultado = await correrPublicacion(commitId, {
      sala: deps.sala,
      almacen: deps.almacen,
      vinculo: deps.vinculo,
      archivoDeCola,
      ...(deps.publicarEnGit !== undefined ? { publicarEnGit: deps.publicarEnGit } : {}),
      ...(deps.falloInyectado !== undefined ? { falloInyectado: deps.falloInyectado } : {}),
    });

    const terminal: DocumentoPublicado = resultado.ok
      ? {
          ...enProceso,
          estado: { tipo: 'publicado', publicadoEn: Date.now() },
        }
      : {
          ...enProceso,
          estado: {
            tipo: 'fallido',
            causa: resultado.causa,
            fallidoEn: Date.now(),
          },
        };

    await persistirYAvisar(deps, contexto, terminal);

    // La acción se aceptó (el host la atendió). El resultado vive en estado-de-push.
    return {
      ok: true,
      avisos: [{ destino: 'todos', mensaje: { tipo: 'estado-de-push', ...aEntrada(terminal) } }],
    };
  };
}
