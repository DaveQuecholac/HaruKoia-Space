/**
 * Cola de trabajos de publicación en el host (H5 / P3 / H5-T4).
 *
 * Persistida en disco. No escribe markdown, no hace git, no toca la UI.
 * El procesador es inyectable (P4 cableará la variante).
 *
 * Idempotencia: un commit no puede tener dos trabajos activos
 * (`pendiente` / `en-proceso`) ni re-encolarse si ya está `publicado`.
 * Tras `fallido`, `reintentar` o un nuevo `encolar` vuelve a ponerse en cola.
 *
 * Al abrir: trabajos `en-proceso` (proceso muerto a mitad) vuelven a
 * `pendiente` para que el rearranque los retome (sin silencios).
 */

import fs from 'node:fs';
import path from 'node:path';

import type { IdentificadorDeCommit, VarianteDePublicacion } from '@harukoia/domain';

import {
  comoTrabajoDePublicacion,
  crearTrabajoDePublicacion,
  type TrabajoDePublicacion,
} from '../trabajo-de-publicacion/trabajo-de-publicacion.ts';

export type ResultadoDelProcesador =
  | { readonly ok: true }
  | { readonly ok: false; readonly causa: string };

export type ProcesadorDePublicacion = (
  trabajo: TrabajoDePublicacion,
) => Promise<ResultadoDelProcesador>;

export type ResultadoDeEncolar =
  | { readonly ok: true; readonly trabajo: TrabajoDePublicacion }
  | {
      readonly ok: false;
      readonly causa: 'ya-encolado' | 'ya-publicado';
      readonly trabajoExistente: TrabajoDePublicacion;
    };

export type ResultadoDeReintentar =
  | { readonly ok: true; readonly trabajo: TrabajoDePublicacion }
  | {
      readonly ok: false;
      readonly causa: 'no-encontrado' | 'no-fallido';
    };

export type ResultadoDeProcesar =
  | { readonly ok: true; readonly trabajo: TrabajoDePublicacion | null }
  | { readonly ok: false; readonly causa: string; readonly trabajo: TrabajoDePublicacion };

export type ColaDePublicacion = {
  encolar(
    commit: IdentificadorDeCommit,
    opciones?: { variante?: VarianteDePublicacion; ahora?: number },
  ): ResultadoDeEncolar;
  reintentar(id: string, opciones?: { ahora?: number }): ResultadoDeReintentar;
  procesarSiguiente(
    procesador: ProcesadorDePublicacion,
    opciones?: { ahora?: number },
  ): Promise<ResultadoDeProcesar>;
  listar(): readonly TrabajoDePublicacion[];
  leer(id: string): TrabajoDePublicacion | null;
  /** Ruta del archivo de persistencia (para pruebas de rearranque). */
  readonly archivo: string;
};

type EstadoPersistido = {
  readonly version: 1;
  readonly trabajos: TrabajoDePublicacion[];
};

function leerDisco(archivo: string): TrabajoDePublicacion[] {
  if (!fs.existsSync(archivo)) return [];
  const crudo = JSON.parse(fs.readFileSync(archivo, 'utf8')) as unknown;
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error(`cola de publicación corrupta: ${archivo}`);
  }
  const datos = crudo as Record<string, unknown>;
  if (datos.version !== 1 || !Array.isArray(datos.trabajos)) {
    throw new Error(`cola de publicación con versión desconocida: ${archivo}`);
  }
  return datos.trabajos.map((t) => comoTrabajoDePublicacion(t));
}

function escribirDisco(archivo: string, trabajos: readonly TrabajoDePublicacion[]): void {
  const dir = path.dirname(archivo);
  fs.mkdirSync(dir, { recursive: true });
  const estado: EstadoPersistido = { version: 1, trabajos: [...trabajos] };
  const temporal = `${archivo}.${process.pid}.tmp`;
  fs.writeFileSync(temporal, `${JSON.stringify(estado, null, 2)}\n`, 'utf8');
  fs.renameSync(temporal, archivo);
}

function recuperarInterrumpidos(
  trabajos: TrabajoDePublicacion[],
  ahora: number,
): TrabajoDePublicacion[] {
  return trabajos.map((t) => {
    if (t.estado !== 'en-proceso') return t;
    return {
      ...t,
      estado: 'pendiente' as const,
      actualizadoEn: ahora,
      causa: 'proceso-interrumpido',
    };
  });
}

function trabajoActivoDelCommit(
  trabajos: readonly TrabajoDePublicacion[],
  commit: IdentificadorDeCommit,
): TrabajoDePublicacion | undefined {
  return trabajos.find(
    (t) =>
      t.commit === commit && (t.estado === 'pendiente' || t.estado === 'en-proceso'),
  );
}

function trabajoPublicadoDelCommit(
  trabajos: readonly TrabajoDePublicacion[],
  commit: IdentificadorDeCommit,
): TrabajoDePublicacion | undefined {
  return trabajos.find((t) => t.commit === commit && t.estado === 'publicado');
}

export function abrirColaDePublicacion(
  archivo: string,
  opciones?: { ahora?: number },
): ColaDePublicacion {
  const ahoraApertura = opciones?.ahora ?? Date.now();
  let trabajos = recuperarInterrumpidos(leerDisco(archivo), ahoraApertura);
  escribirDisco(archivo, trabajos);

  const persistir = (): void => {
    escribirDisco(archivo, trabajos);
  };

  return {
    archivo,

    encolar(commit, opcionesEncolar) {
      const activo = trabajoActivoDelCommit(trabajos, commit);
      if (activo) {
        return { ok: false, causa: 'ya-encolado', trabajoExistente: activo };
      }
      const publicado = trabajoPublicadoDelCommit(trabajos, commit);
      if (publicado) {
        return { ok: false, causa: 'ya-publicado', trabajoExistente: publicado };
      }

      const ahora = opcionesEncolar?.ahora ?? Date.now();
      const trabajo = crearTrabajoDePublicacion({
        commit,
        creadoEn: ahora,
        ...(opcionesEncolar?.variante !== undefined
          ? { variante: opcionesEncolar.variante }
          : {}),
      });
      trabajos = [...trabajos, trabajo];
      persistir();
      return { ok: true, trabajo };
    },

    reintentar(id, opcionesReintento) {
      const indice = trabajos.findIndex((t) => t.id === id);
      if (indice < 0) return { ok: false, causa: 'no-encontrado' };
      const actual = trabajos[indice]!;
      if (actual.estado !== 'fallido') return { ok: false, causa: 'no-fallido' };

      const ahora = opcionesReintento?.ahora ?? Date.now();
      const siguiente: TrabajoDePublicacion = {
        id: actual.id,
        commit: actual.commit,
        variante: actual.variante,
        estado: 'pendiente',
        intentos: actual.intentos,
        creadoEn: actual.creadoEn,
        actualizadoEn: ahora,
      };
      trabajos = trabajos.map((t, i) => (i === indice ? siguiente : t));
      persistir();
      return { ok: true, trabajo: siguiente };
    },

    async procesarSiguiente(procesador, opcionesProceso) {
      const indice = trabajos.findIndex((t) => t.estado === 'pendiente');
      if (indice < 0) return { ok: true, trabajo: null };

      const ahoraInicio = opcionesProceso?.ahora ?? Date.now();
      const pendiente = trabajos[indice]!;
      const marcado: TrabajoDePublicacion = {
        id: pendiente.id,
        commit: pendiente.commit,
        variante: pendiente.variante,
        estado: 'en-proceso',
        intentos: pendiente.intentos + 1,
        creadoEn: pendiente.creadoEn,
        actualizadoEn: ahoraInicio,
      };
      trabajos = trabajos.map((t, i) => (i === indice ? marcado : t));
      persistir();

      let resultado: ResultadoDelProcesador;
      try {
        resultado = await procesador(marcado);
      } catch (error) {
        const causa =
          error instanceof Error && error.message.trim() !== ''
            ? error.message
            : 'procesador-lanzo';
        resultado = { ok: false, causa };
      }

      const ahoraFin = opcionesProceso?.ahora ?? Date.now();
      const terminal: TrabajoDePublicacion = resultado.ok
        ? {
            id: marcado.id,
            commit: marcado.commit,
            variante: marcado.variante,
            estado: 'publicado',
            intentos: marcado.intentos,
            creadoEn: marcado.creadoEn,
            actualizadoEn: ahoraFin,
          }
        : {
            id: marcado.id,
            commit: marcado.commit,
            variante: marcado.variante,
            estado: 'fallido',
            intentos: marcado.intentos,
            creadoEn: marcado.creadoEn,
            actualizadoEn: ahoraFin,
            causa: resultado.causa.trim() === '' ? 'causa-vacia' : resultado.causa.trim(),
          };

      trabajos = trabajos.map((t) => (t.id === marcado.id ? terminal : t));
      persistir();

      if (resultado.ok) return { ok: true, trabajo: terminal };
      return { ok: false, causa: terminal.causa!, trabajo: terminal };
    },

    listar() {
      return [...trabajos];
    },

    leer(id) {
      return trabajos.find((t) => t.id === id) ?? null;
    },
  };
}
