/**
 * Serialización de los mensajes de sala. Fijado en el paso B8, con la misma
 * forma que el codec de control: texto JSON y un lector por tipo.
 *
 * Lo que llega de un participante no es de fiar: se valida campo por campo y
 * cualquier cosa fuera del contrato se devuelve como ilegible, con detalle.
 */

import { comoIdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import { ESTADOS_DE_PUSH } from '../../documento/estado-de-push/estado-de-push.ts';
import { ACCIONES_DE_SALA, CAUSAS_DE_ACCION_RECHAZADA } from '../accion-de-sala/accion-de-sala.ts';
import { comoTokenDeInvitacion } from '../identidad-de-sala/identidad-de-sala.ts';
import { ROLES } from '../rol/rol.ts';
import type {
  EntradaDeEstadoDePush,
  EntradaDeHistorial,
  MensajeDeSala,
  TipoDeMensajeDeSala,
} from './mensaje-de-sala.ts';

export type InterpretacionDeSala =
  | { readonly ok: true; readonly mensaje: MensajeDeSala }
  | { readonly ok: false; readonly detalle: string };

export function serializarMensajeDeSala(mensaje: MensajeDeSala): string {
  return JSON.stringify(mensaje);
}

function unoDe<T extends string>(datos: Record<string, unknown>, clave: string, permitidos: readonly T[]): T {
  const valor = datos[clave];
  if (typeof valor !== 'string' || !(permitidos as readonly string[]).includes(valor)) {
    throw new Error(`"${clave}" no es un valor reconocido`);
  }
  return valor as T;
}

const LECTORES: Record<TipoDeMensajeDeSala, (datos: Record<string, unknown>) => MensajeDeSala> = {
  'pedir-accion': (datos) => {
    const accion = unoDe(datos, 'accion', ACCIONES_DE_SALA);
    if (accion === 'commitear') {
      if (typeof datos.mensaje !== 'string') throw new Error('"mensaje" no es texto');
      return { tipo: 'pedir-accion', accion: 'commitear', mensaje: datos.mensaje };
    }
    if (accion === 'hacer-checkout' || accion === 'publicar' || accion === 'reintentar-publicacion') {
      return {
        tipo: 'pedir-accion',
        accion,
        id: comoIdentificadorDeCommit(datos.id),
      };
    }
    return { tipo: 'pedir-accion', accion: 'cambiar-invitacion' };
  },
  'tu-rol': (datos) => ({ tipo: 'tu-rol', rol: unoDe(datos, 'rol', ROLES) }),
  'accion-rechazada': (datos) => ({
    tipo: 'accion-rechazada',
    accion: unoDe(datos, 'accion', ACCIONES_DE_SALA),
    causa: unoDe(datos, 'causa', CAUSAS_DE_ACCION_RECHAZADA),
  }),
  'invitacion-cambiada': (datos) => ({
    tipo: 'invitacion-cambiada',
    tokenDeInvitacion: comoTokenDeInvitacion(datos['tokenDeInvitacion']),
  }),
  historial: (datos) => {
    if (!Array.isArray(datos.commits)) throw new Error('"commits" no es una lista');
    const estadosCrudos = datos.estadosDePush;
    const estadosDePush = Array.isArray(estadosCrudos)
      ? estadosCrudos.map((entrada, indice) => leerEntradaDeEstadoDePush(entrada, indice))
      : [];
    return {
      tipo: 'historial',
      commits: datos.commits.map((entrada, indice) => leerEntradaDeHistorial(entrada, indice)),
      tip:
        datos.tip === null || datos.tip === undefined
          ? null
          : comoIdentificadorDeCommit(datos.tip),
      estadosDePush,
    };
  },
  'commit-guardado': (datos) => ({
    tipo: 'commit-guardado',
    id: comoIdentificadorDeCommit(datos.id),
    mensaje: textoObligatorio(datos, 'mensaje'),
    autor: textoObligatorio(datos, 'autor'),
    creadoEn: numeroObligatorio(datos, 'creadoEn'),
    padre:
      datos.padre === null || datos.padre === undefined
        ? null
        : comoIdentificadorDeCommit(datos.padre),
  }),
  'checkout-hecho': (datos) => ({
    tipo: 'checkout-hecho',
    id: comoIdentificadorDeCommit(datos.id),
  }),
  'estado-de-push': (datos) => leerEstadoDePushMensaje(datos),
};

function textoObligatorio(datos: Record<string, unknown>, clave: string): string {
  const valor = datos[clave];
  if (typeof valor !== 'string') throw new Error(`"${clave}" no es texto`);
  return valor;
}

function numeroObligatorio(datos: Record<string, unknown>, clave: string): number {
  const valor = datos[clave];
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new Error(`"${clave}" no es un número`);
  }
  return valor;
}

function leerEntradaDeHistorial(valor: unknown, indice: number): EntradaDeHistorial {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error(`"commits[${indice}]" no es un objeto`);
  }
  const datos = valor as Record<string, unknown>;
  return {
    id: comoIdentificadorDeCommit(datos.id),
    mensaje: textoObligatorio(datos, 'mensaje'),
    autor: textoObligatorio(datos, 'autor'),
    creadoEn: numeroObligatorio(datos, 'creadoEn'),
    padre:
      datos.padre === null || datos.padre === undefined
        ? null
        : comoIdentificadorDeCommit(datos.padre),
  };
}

function leerEntradaDeEstadoDePush(valor: unknown, indice: number): EntradaDeEstadoDePush {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error(`"estadosDePush[${indice}]" no es un objeto`);
  }
  return leerEstadoDePushCampos(valor as Record<string, unknown>);
}

function leerEstadoDePushMensaje(datos: Record<string, unknown>): MensajeDeSala {
  const campos = leerEstadoDePushCampos(datos);
  return { tipo: 'estado-de-push', ...campos };
}

function leerEstadoDePushCampos(datos: Record<string, unknown>): EntradaDeEstadoDePush {
  const estadoTipo = unoDe(datos, 'estadoTipo', ESTADOS_DE_PUSH);
  let causa: string | null = null;
  let marca: number | null = null;
  if (estadoTipo === 'fallido') {
    causa = textoObligatorio(datos, 'causa');
    marca = numeroObligatorio(datos, 'marca');
  } else if (estadoTipo === 'publicado') {
    if (datos.causa !== null && datos.causa !== undefined) {
      throw new Error('"causa" sobra en publicado');
    }
    marca = numeroObligatorio(datos, 'marca');
  } else if (datos.causa !== null && datos.causa !== undefined) {
    throw new Error('"causa" sobra en en-proceso');
  } else if (datos.marca !== null && datos.marca !== undefined) {
    throw new Error('"marca" sobra en en-proceso');
  }

  return {
    documento: textoObligatorio(datos, 'documento'),
    commit: comoIdentificadorDeCommit(datos.commit),
    estadoTipo,
    causa,
    marca,
  };
}

export function interpretarMensajeDeSala(texto: string): InterpretacionDeSala {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, detalle: 'no es JSON válido' };
  }
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, detalle: 'se esperaba un objeto' };
  }

  const campos = datos as Record<string, unknown>;
  const tipo = campos['tipo'];
  const lector =
    typeof tipo === 'string' && Object.hasOwn(LECTORES, tipo) ? LECTORES[tipo as TipoDeMensajeDeSala] : undefined;
  if (!lector) return { ok: false, detalle: `tipo desconocido: ${String(tipo)}` };

  try {
    return { ok: true, mensaje: lector(campos) };
  } catch (falla) {
    return { ok: false, detalle: falla instanceof Error ? falla.message : 'campo inválido' };
  }
}
