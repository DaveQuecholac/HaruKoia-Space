/**
 * Identidad de la sala en el keyring del sistema (H3, D2).
 *
 * El documento Yjs vive en su SQLite. Esta identidad no: los tokens no van en
 * claro en ese archivo ni dentro del documento. El almacén es el mismo crate
 * que usa IOKOIA Space en el escritorio (`keyring`), hablado desde Node.
 * El servicio no es el de Space, para no compartir la entrada.
 *
 * En Linux el almacén queda fijado. Sin eso, el binding cae al keyring del
 * kernel, y ese se pierde al reiniciar: la sala no volvería.
 *
 * Una entrada que no está es el primer arranque. Una entrada que no se puede
 * leer no se reemplaza por otra identidad.
 */

import { Entry, type EntryOptions } from '@napi-rs/keyring';
import {
  type IdentidadDeSala,
  comoIdentificadorDeSala,
  comoTokenDeHost,
  comoTokenDeInvitacion,
  comoTokenDeWebDelHost,
} from '@harukoia/domain';

export const SERVICIO_DE_LA_IDENTIDAD = 'iokoia.harukoia';
export const CUENTA_POR_DEFECTO = 'identidad-de-sala';

const CAMPOS = ['sala', 'tokenDeHost', 'tokenDeInvitacion', 'tokenDeWebDelHost'] as const;

const OPCIONES: EntryOptions = { linux: { store: 'secret-service' } };

export function cuentaDeLaIdentidad(env: { SALA_IDENTIDAD?: string }): string {
  if (env.SALA_IDENTIDAD !== undefined) {
    if (env.SALA_IDENTIDAD === '') throw new Error('SALA_IDENTIDAD está vacía');
    return env.SALA_IDENTIDAD;
  }
  return CUENTA_POR_DEFECTO;
}

export function leerIdentidad(cuenta: string): IdentidadDeSala | null {
  const crudo = entrada(cuenta).getPassword();
  if (crudo === null) return null;
  return interpretar(crudo);
}

export function guardarIdentidad(cuenta: string, identidad: IdentidadDeSala): void {
  entrada(cuenta).setPassword(serializar(identidad));
}

/**
 * Lee la cuenta. Si no hay entrada, llama a `crear` una vez y guarda el
 * resultado. Si la entrada no se puede leer, `crear` no se llama.
 */
export function identidadParaArrancar(cuenta: string, crear: () => IdentidadDeSala): IdentidadDeSala {
  const existente = leerIdentidad(cuenta);
  if (existente) return existente;
  const nueva = crear();
  guardarIdentidad(cuenta, nueva);
  return nueva;
}

function entrada(cuenta: string): Entry {
  return new Entry(SERVICIO_DE_LA_IDENTIDAD, cuenta, OPCIONES);
}

function serializar(identidad: IdentidadDeSala): string {
  return JSON.stringify({
    sala: identidad.sala,
    tokenDeHost: identidad.tokenDeHost,
    tokenDeInvitacion: identidad.tokenDeInvitacion,
    tokenDeWebDelHost: identidad.tokenDeWebDelHost,
  });
}

function interpretar(crudo: string): IdentidadDeSala {
  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch {
    throw new Error('la identidad guardada no se puede leer');
  }
  if (!esObjeto(valor) || !tieneLosCuatroCampos(valor)) {
    throw new Error('la identidad guardada no se puede leer');
  }
  try {
    return {
      sala: comoIdentificadorDeSala(valor.sala),
      tokenDeHost: comoTokenDeHost(valor.tokenDeHost),
      tokenDeInvitacion: comoTokenDeInvitacion(valor.tokenDeInvitacion),
      tokenDeWebDelHost: comoTokenDeWebDelHost(valor.tokenDeWebDelHost),
    };
  } catch {
    throw new Error('la identidad guardada no se puede leer');
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function tieneLosCuatroCampos(valor: Record<string, unknown>): boolean {
  const claves = Object.keys(valor);
  return claves.length === CAMPOS.length && CAMPOS.every((campo) => claves.includes(campo));
}
