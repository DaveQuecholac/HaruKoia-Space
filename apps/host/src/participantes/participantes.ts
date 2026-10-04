/**
 * Participantes de la sala. Fijado en el paso B5.
 *
 * Un participante es un cliente con presencia en el documento de la sala. La
 * fuente es la presencia de Yjs, no una lista aparte: así un participante que
 * se cae sucio desaparece por el mismo tiempo de espera que su presencia, y no
 * hay dos listas que puedan contradecirse.
 *
 * Qué lleva el estado de cada uno (nombre, cursor) lo fija B6 con D9. Aquí es
 * opaco.
 */

export type Participante = {
  /** El identificador de cliente de Yjs. Cambia si el participante reconecta. */
  readonly cliente: number;
  readonly estado: Readonly<Record<string, unknown>>;
};

/**
 * La lista a partir de los estados de presencia del documento. `propio` es el
 * cliente del documento en el host, que no es un participante.
 */
export function participantesDe(
  estados: ReadonlyMap<number, Record<string, unknown>>,
  propio: number,
): Participante[] {
  return [...estados]
    .filter(([cliente]) => cliente !== propio)
    .map(([cliente, estado]) => ({ cliente, estado }));
}
