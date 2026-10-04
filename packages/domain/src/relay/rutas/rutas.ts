/**
 * Rutas del relay. Fijado en el paso B3.
 *
 * Las tres conexiones que existen en el motor, cada una con su propósito. Están
 * aquí y no dentro del orquestador porque host y web también las necesitan: si
 * cada proceso escribiera su propia cadena, un cambio de ruta se convertiría en
 * tres cambios y un bug.
 *
 * **Ningún secreto viaja en estas rutas.** El token del invitado va en su
 * primer mensaje (decisión 3 de B3), no en la URL, para que no acabe escrito en
 * los logs de acceso del proxy.
 */

export const RUTAS = {
  /** Host → orquestador. Permanente, una por sala. Lleva control, no datos. */
  control: '/relay/control',
  /** Invitado → orquestador. Se vuelve conexión de datos al emparejarse. */
  invitado: '/relay/sala',
  /** Host → orquestador. Una por invitado, saliente. Es el túnel inverso. */
  datos: '/relay/datos',
} as const;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];

export function esRutaDelRelay(ruta: string): ruta is Ruta {
  return Object.values(RUTAS).includes(ruta as Ruta);
}
