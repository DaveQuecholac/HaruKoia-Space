/**
 * Traductor tablero ↔ JSON (H4-T1, T2, T3).
 *
 * Entrada viva: registros del `Y.Map` `tablero` (cada valor es un registro con
 * `id` + `typeName`, como fijó H2). Salida: `TableroEnJson` con formas propias.
 *
 * H2: cámara y presencia no forman parte del tablero versionado. Si el mapa
 * aún trae registros de sesión (p. ej. `user`), se omiten al exportar.
 *
 * Si tldraw cambia sus campos internos, solo este archivo (y las formas) se tocan.
 */

import {
  type FormaDeTablero,
  type MetaDeForma,
  interpretarForma,
} from '../forma-de-tablero/forma-de-tablero.ts';
import {
  FORMATO_DE_TABLERO,
  type TableroEnJson,
  interpretarTableroEnJson,
} from '../formato-de-tablero/formato-de-tablero.ts';

/** typeName que sí forman el documento compartido (mapa `tablero` / commit). */
export const TIPOS_DEL_DOCUMENTO_DEL_TABLERO = new Set([
  'document',
  'page',
  'shape',
  'asset',
  'binding',
]);

/**
 * typeName de tldraw que son de sesión / UI, no del documento compartido.
 * No van al JSON del commit (H2: presencia y cámara fuera del mapa).
 */
export const TIPOS_DE_SESION_DEL_LIENZO = new Set([
  'user',
  'camera',
  'instance',
  'instance_page_state',
  'pointer',
  'instance_presence',
  'presence',
]);

/** ¿Este registro pertenece al documento versionable? */
export function esRegistroDelDocumentoDelTablero(typeName: string): boolean {
  return TIPOS_DEL_DOCUMENTO_DEL_TABLERO.has(typeName);
}

/** Registro crudo como vive en el mapa `tablero` (JSON parseado). */
export type RegistroDelTablero = {
  readonly id: string;
  readonly typeName: string;
  readonly [clave: string]: unknown;
};

export type ResultadoDeExportacion =
  | { readonly ok: true; readonly tablero: TableroEnJson }
  | {
      readonly ok: false;
      readonly causa: 'registro-invalido' | 'tipo-de-registro-desconocido' | 'campos-de-registro-invalidos';
      readonly id?: string;
    };

export type ResultadoDeImportacion =
  | { readonly ok: true; readonly registros: Readonly<Record<string, RegistroDelTablero>> }
  | {
      readonly ok: false;
      readonly causa:
        | 'formato-invalido'
        | 'formato-desconocido'
        | 'forma-invalida'
        | 'tipo-desconocido'
        | 'id-duplicado';
      readonly detalle?: string;
    };

/**
 * Registros del documento → JSON versionado.
 * Orden estable por `id` para diffs limpios.
 */
export function exportarTableroAJson(
  registros: Readonly<Record<string, unknown>>,
): ResultadoDeExportacion {
  const formas: FormaDeTablero[] = [];
  const ids = Object.keys(registros).sort();

  for (const id of ids) {
    const crudo = registros[id];
    const leido = comoRegistro(crudo, id);
    if (!leido.ok) {
      return { ok: false, causa: leido.causa, id };
    }
    if (TIPOS_DE_SESION_DEL_LIENZO.has(leido.registro.typeName)) {
      continue;
    }
    const forma = registroAForma(leido.registro);
    if (!forma.ok) {
      return { ok: false, causa: forma.causa, id };
    }
    formas.push(forma.forma);
  }

  return { ok: true, tablero: { formato: FORMATO_DE_TABLERO, formas } };
}

/** JSON versionado → registros listos para el mapa `tablero` / el store. */
export function importarTableroDesdeJson(valor: unknown): ResultadoDeImportacion {
  const interpretado = interpretarTableroEnJson(valor);
  if (!interpretado.ok) {
    if (interpretado.causa === 'formato-desconocido') {
      return { ok: false, causa: 'formato-desconocido' };
    }
    if (interpretado.causa === 'forma-desconocida') {
      return { ok: false, causa: 'tipo-desconocido' };
    }
    if (interpretado.causa === 'forma-invalida') {
      return { ok: false, causa: 'forma-invalida', detalle: interpretado.causa };
    }
    return { ok: false, causa: 'formato-invalido', detalle: interpretado.causa };
  }

  const registros: Record<string, RegistroDelTablero> = {};

  for (const cruda of interpretado.tablero.formas) {
    const forma = interpretarForma(cruda);
    if (!forma.ok) {
      if (forma.causa === 'tipo-desconocido') {
        return { ok: false, causa: 'tipo-desconocido' };
      }
      return { ok: false, causa: 'forma-invalida', detalle: forma.causa };
    }
    if (forma.forma.id in registros) {
      return { ok: false, causa: 'id-duplicado', detalle: forma.forma.id };
    }
    registros[forma.forma.id] = formaARegistro(forma.forma);
  }

  return { ok: true, registros };
}

function comoRegistro(
  valor: unknown,
  idEsperado: string,
):
  | { readonly ok: true; readonly registro: RegistroDelTablero }
  | { readonly ok: false; readonly causa: 'registro-invalido' } {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'registro-invalido' };
  }
  const datos = valor as Record<string, unknown>;
  if (typeof datos.id !== 'string' || datos.id !== idEsperado) {
    return { ok: false, causa: 'registro-invalido' };
  }
  if (typeof datos.typeName !== 'string') {
    return { ok: false, causa: 'registro-invalido' };
  }
  return { ok: true, registro: datos as RegistroDelTablero };
}

function registroAForma(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | {
      readonly ok: false;
      readonly causa: 'tipo-de-registro-desconocido' | 'campos-de-registro-invalidos';
    } {
  switch (registro.typeName) {
    case 'document':
      return documentoDesdeRegistro(registro);
    case 'page':
      return paginaDesdeRegistro(registro);
    case 'shape':
      return figuraDesdeRegistro(registro);
    case 'asset':
      return recursoDesdeRegistro(registro);
    case 'binding':
      return vinculoDesdeRegistro(registro);
    default:
      return { ok: false, causa: 'tipo-de-registro-desconocido' };
  }
}

function documentoDesdeRegistro(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'campos-de-registro-invalidos' } {
  if (typeof registro.name !== 'string' || typeof registro.gridSize !== 'number') {
    return { ok: false, causa: 'campos-de-registro-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'documento',
      id: registro.id,
      nombre: registro.name,
      tamanoDeGrilla: registro.gridSize,
      meta: metaDe(registro.meta),
    },
  };
}

function paginaDesdeRegistro(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'campos-de-registro-invalidos' } {
  if (typeof registro.name !== 'string' || typeof registro.index !== 'string') {
    return { ok: false, causa: 'campos-de-registro-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'pagina',
      id: registro.id,
      nombre: registro.name,
      indice: registro.index,
      meta: metaDe(registro.meta),
    },
  };
}

function figuraDesdeRegistro(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'campos-de-registro-invalidos' } {
  if (
    typeof registro.type !== 'string' ||
    typeof registro.x !== 'number' ||
    typeof registro.y !== 'number' ||
    typeof registro.rotation !== 'number' ||
    typeof registro.index !== 'string' ||
    typeof registro.parentId !== 'string' ||
    typeof registro.isLocked !== 'boolean' ||
    typeof registro.opacity !== 'number' ||
    !esObjeto(registro.props)
  ) {
    return { ok: false, causa: 'campos-de-registro-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'figura',
      id: registro.id,
      figura: registro.type,
      x: registro.x,
      y: registro.y,
      rotacion: registro.rotation,
      indice: registro.index,
      padre: registro.parentId,
      bloqueado: registro.isLocked,
      opacidad: registro.opacity,
      props: registro.props as MetaDeForma,
      meta: metaDe(registro.meta),
    },
  };
}

function recursoDesdeRegistro(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'campos-de-registro-invalidos' } {
  if (typeof registro.type !== 'string' || !esObjeto(registro.props)) {
    return { ok: false, causa: 'campos-de-registro-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'recurso',
      id: registro.id,
      recurso: registro.type,
      props: registro.props as MetaDeForma,
      meta: metaDe(registro.meta),
    },
  };
}

function vinculoDesdeRegistro(
  registro: RegistroDelTablero,
):
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'campos-de-registro-invalidos' } {
  if (
    typeof registro.type !== 'string' ||
    typeof registro.fromId !== 'string' ||
    typeof registro.toId !== 'string' ||
    !esObjeto(registro.props)
  ) {
    return { ok: false, causa: 'campos-de-registro-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'vinculo',
      id: registro.id,
      vinculo: registro.type,
      desde: registro.fromId,
      hacia: registro.toId,
      props: registro.props as MetaDeForma,
      meta: metaDe(registro.meta),
    },
  };
}

function formaARegistro(forma: FormaDeTablero): RegistroDelTablero {
  switch (forma.tipo) {
    case 'documento':
      return {
        id: forma.id,
        typeName: 'document',
        name: forma.nombre,
        gridSize: forma.tamanoDeGrilla,
        meta: { ...forma.meta },
      };
    case 'pagina':
      return {
        id: forma.id,
        typeName: 'page',
        name: forma.nombre,
        index: forma.indice,
        meta: { ...forma.meta },
      };
    case 'figura':
      return {
        id: forma.id,
        typeName: 'shape',
        type: forma.figura,
        x: forma.x,
        y: forma.y,
        rotation: forma.rotacion,
        index: forma.indice,
        parentId: forma.padre,
        isLocked: forma.bloqueado,
        opacity: forma.opacidad,
        props: { ...forma.props },
        meta: { ...forma.meta },
      };
    case 'recurso':
      return {
        id: forma.id,
        typeName: 'asset',
        type: forma.recurso,
        props: { ...forma.props },
        meta: { ...forma.meta },
      };
    case 'vinculo':
      return {
        id: forma.id,
        typeName: 'binding',
        type: forma.vinculo,
        fromId: forma.desde,
        toId: forma.hacia,
        props: { ...forma.props },
        meta: { ...forma.meta },
      };
  }
}

function metaDe(valor: unknown): MetaDeForma {
  if (esObjeto(valor)) return valor as MetaDeForma;
  return {};
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}
