/**
 * Identificador de una conexión de invitado. Fijado en el paso B1.
 *
 * Lo genera el orquestador cuando un invitado llega, y el host lo presenta al
 * abrir la conexión de datos saliente. Es la clave con la que el orquestador
 * une las dos puntas, así que no es adivinable: usa la misma longitud y el
 * mismo alfabeto que un identificador de sala.
 */

import {
  type Identificador,
  comoIdentificador,
  generarIdentificador,
} from '../../identificador/identificador.ts';
import { LONGITUD_DEL_IDENTIFICADOR } from '../../sala/identidad-de-sala/identidad-de-sala.ts';

export type IdentificadorDeConexion = Identificador<'conexion'>;

export function generarIdentificadorDeConexion(): IdentificadorDeConexion {
  return generarIdentificador<'conexion'>(LONGITUD_DEL_IDENTIFICADOR);
}

export function comoIdentificadorDeConexion(valor: unknown): IdentificadorDeConexion {
  return comoIdentificador<'conexion'>(valor, LONGITUD_DEL_IDENTIFICADOR);
}
