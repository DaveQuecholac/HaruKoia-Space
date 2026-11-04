/**
 * Campos de control que lleva todo documento que se replica, y las reglas de
 * orden y de borrado. Fijado en el paso A5.
 *
 * El host es la autoridad: él asigna `actualizadoEn` al aceptar una escritura.
 * El cliente **nunca** manda esa marca, porque su reloj puede ir atrasado o
 * adelantado y el orden de la réplica dejaría de ser determinista.
 */

export type DocumentoReplicado = {
  readonly id: string;
  /** Milisegundos del reloj del host. Lo asigna el host, nunca el cliente. */
  readonly actualizadoEn: number;
  /** Borrado lógico. Lo replicado nunca se borra físicamente. */
  readonly borrado: boolean;
};

/**
 * Punto hasta donde un cliente ya trajo cambios. Null significa "desde el
 * principio". El identificador desempata los documentos con la misma marca.
 */
export type Checkpoint = {
  readonly actualizadoEn: number;
  readonly id: string;
} | null;

/**
 * Orden total y determinista: primero por marca del host, y a marca igual, por
 * identificador. Sin el desempate, dos documentos escritos en el mismo
 * milisegundo podrían perderse al paginar desde un checkpoint.
 */
export function compararOrdenDeReplica(
  a: Pick<DocumentoReplicado, 'actualizadoEn' | 'id'>,
  b: Pick<DocumentoReplicado, 'actualizadoEn' | 'id'>,
): number {
  if (a.actualizadoEn !== b.actualizadoEn) return a.actualizadoEn - b.actualizadoEn;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function esPosteriorAlCheckpoint(
  documento: Pick<DocumentoReplicado, 'actualizadoEn' | 'id'>,
  checkpoint: Checkpoint,
): boolean {
  if (checkpoint === null) return true;
  return compararOrdenDeReplica(documento, checkpoint) > 0;
}

/**
 * Trae los documentos que faltan después del checkpoint, en orden y con tope.
 * Es la operación que el host expone para que un cliente se ponga al día.
 */
export function traerDesdeCheckpoint<T extends Pick<DocumentoReplicado, 'actualizadoEn' | 'id'>>(
  documentos: readonly T[],
  checkpoint: Checkpoint,
  limite: number,
): { documentos: T[]; checkpoint: Checkpoint } {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new RangeError('el límite debe ser un entero positivo');
  }

  const siguientes = documentos
    .filter((documento) => esPosteriorAlCheckpoint(documento, checkpoint))
    .sort(compararOrdenDeReplica)
    .slice(0, limite);

  const ultimo = siguientes.at(-1);

  return {
    documentos: siguientes,
    checkpoint: ultimo ? { actualizadoEn: ultimo.actualizadoEn, id: ultimo.id } : checkpoint,
  };
}
