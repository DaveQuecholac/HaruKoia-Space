/**
 * Canales del relay. Fijado en el paso B1.
 *
 * Un canal dice **para qué** se abre una conexión de datos, no qué se manda
 * por ella. El relay no interpreta el contenido de ninguno: solo lo enruta.
 *
 * Hoy existe uno. Cuando entre la réplica de la base local (H3) será otro
 * miembro de esta unión más su manejador en el host, y **ni el orquestador ni
 * este archivo cambian de forma**. Este es el único lugar del repositorio que
 * enumera canales.
 */

export const CANALES = ['sesion'] as const;

export type Canal = (typeof CANALES)[number];

export function esCanal(valor: unknown): valor is Canal {
  return typeof valor === 'string' && (CANALES as readonly string[]).includes(valor);
}
