/**
 * Espera entre reintentos de conexión. Fijado en el paso B4.
 *
 * El máximo de cada intento se duplica hasta un tope, y la espera real cae al
 * azar entre la mitad y ese máximo. La mitad fija garantiza que la espera
 * crece de verdad; la otra mitad al azar evita la tormenta de reconexión
 * cuando el orquestador se reinicia y todos los hosts vuelven a la vez.
 */

export const ESPERA_BASE = 500;
export const ESPERA_TOPE = 30_000;

export type EsperaCreciente = {
  /** Milisegundos a esperar antes del próximo intento. Cuenta el intento. */
  readonly siguiente: () => number;
  /** Tras una conexión buena, el próximo fallo vuelve a empezar desde abajo. */
  readonly reiniciar: () => void;
  readonly intentos: () => number;
};

export type OpcionesDeEspera = {
  readonly base?: number;
  readonly tope?: number;
  /** Devuelve un número en [0, 1). Se inyecta en las pruebas. */
  readonly azar?: () => number;
};

export function crearEsperaCreciente(opciones: OpcionesDeEspera = {}): EsperaCreciente {
  const base = opciones.base ?? ESPERA_BASE;
  const tope = opciones.tope ?? ESPERA_TOPE;
  const azar = opciones.azar ?? Math.random;
  let intentos = 0;

  return {
    siguiente: () => {
      const maximo = Math.min(tope, base * 2 ** intentos);
      intentos += 1;
      return Math.round(maximo / 2 + azar() * (maximo / 2));
    },
    reiniciar: () => {
      intentos = 0;
    },
    intentos: () => intentos,
  };
}
