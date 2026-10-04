/**
 * Identificadores del motor: salas, commits, participantes, conexiones.
 *
 * Reglas fijadas en el paso A5:
 *   - Alfabeto de 32 símbolos sin los que se confunden al leer o dictar (i, l, o, u).
 *   - Cada carácter aporta exactamente 5 bits, así que no hay sesgo al generar.
 *   - Longitud mínima de 16 caracteres, o sea 80 bits: un identificador de sala
 *     viaja en un link y no debe poder adivinarse.
 *   - Se generan con Web Crypto, disponible igual en el navegador y en Node.
 */

export const ALFABETO = 'abcdefghjkmnpqrstvwxyz0123456789';

const BITS_POR_CARACTER = 5;

export const LONGITUD_MINIMA = 16;

/**
 * Cadena opaca que no se puede confundir con otra clase de identificador.
 * `Identificador<'sala'>` no es asignable a `Identificador<'commit'>`.
 */
export type Identificador<Clase extends string> = string & { readonly clase: Clase };

export function generarIdentificador<Clase extends string>(
  longitud: number = LONGITUD_MINIMA,
): Identificador<Clase> {
  if (!Number.isInteger(longitud) || longitud < LONGITUD_MINIMA) {
    throw new RangeError(`la longitud debe ser un entero de al menos ${LONGITUD_MINIMA}`);
  }

  const bytes = new Uint8Array(Math.ceil((longitud * BITS_POR_CARACTER) / 8));
  globalThis.crypto.getRandomValues(bytes);

  let acumulado = 0;
  let bitsDisponibles = 0;
  let salida = '';

  for (const byte of bytes) {
    acumulado = (acumulado << 8) | byte;
    bitsDisponibles += 8;

    while (bitsDisponibles >= BITS_POR_CARACTER && salida.length < longitud) {
      bitsDisponibles -= BITS_POR_CARACTER;
      const indice = (acumulado >> bitsDisponibles) & 0b11111;
      salida += ALFABETO[indice];
    }
  }

  return salida as Identificador<Clase>;
}

export function esIdentificador(valor: unknown, longitud?: number): boolean {
  if (typeof valor !== 'string') return false;
  if (valor.length < LONGITUD_MINIMA) return false;
  if (longitud !== undefined && valor.length !== longitud) return false;

  for (const caracter of valor) {
    if (!ALFABETO.includes(caracter)) return false;
  }

  return true;
}

/**
 * Convierte una cadena recibida de fuera en un identificador tipado, o falla.
 * Es el único camino permitido: nunca se castea a mano lo que llega de la red.
 */
export function comoIdentificador<Clase extends string>(
  valor: unknown,
  longitud?: number,
): Identificador<Clase> {
  if (!esIdentificador(valor, longitud)) {
    throw new TypeError('identificador inválido');
  }
  return valor as Identificador<Clase>;
}
