/**
 * Cursor y selección de los demás en el lienzo.
 *
 * El nombre sigue en el awareness de la sala. Aquí solo se leen esos estados
 * y se pintan como presencia de tldraw. Quien no trae nombre no se dibuja.
 */

import {
  InstancePresenceRecordType,
  createUserId,
  getDefaultUserPresence,
  type Editor,
  type TLInstancePresence,
  type TLPageId,
  type TLShapeId,
  type TLStore,
} from 'tldraw';

import type { PresenciaDelLienzo } from '../conexion-a-la-sala/conexion-a-la-sala.ts';

const COLORES = ['#e85d4c', '#2f6fed', '#1f9d55', '#d4a017', '#7c4dff', '#0e8a8a'] as const;

export type PresenciaAjena = {
  readonly cliente: number;
  readonly nombre: string;
  readonly cursor: { readonly x: number; readonly y: number } | null;
  readonly seleccion: readonly TLShapeId[];
  readonly pagina: TLPageId;
};

function colorDe(cliente: number): string {
  return COLORES[Math.abs(cliente) % COLORES.length] ?? COLORES[0];
}

function leerCursor(valor: unknown): { readonly x: number; readonly y: number } | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const x = Reflect.get(valor, 'x');
  const y = Reflect.get(valor, 'y');
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function leerSeleccion(valor: unknown): readonly TLShapeId[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((id): id is TLShapeId => typeof id === 'string' && id.startsWith('shape:'));
}

/** Los demás, con nombre y página. El cliente propio y el anónimo quedan fuera. */
export function leerPresenciasAjenas(
  estados: ReadonlyMap<number, Record<string, unknown>>,
  propio: number,
): PresenciaAjena[] {
  const ajenas: PresenciaAjena[] = [];
  for (const [cliente, estado] of estados) {
    if (cliente === propio) continue;
    if (typeof estado.nombre !== 'string' || estado.nombre.trim() === '') continue;
    if (typeof estado.pagina !== 'string' || !estado.pagina.startsWith('page:')) continue;
    ajenas.push({
      cliente,
      nombre: estado.nombre,
      cursor: leerCursor(estado.cursor),
      seleccion: leerSeleccion(estado.seleccion),
      pagina: estado.pagina as TLPageId,
    });
  }
  return ajenas;
}

/**
 * Escribe la presencia ajena en el store y quita la de quien ya no está.
 * `puestas` recuerda las que escribió esta función.
 */
export function aplicarPresencias(
  store: TLStore,
  ajenas: readonly PresenciaAjena[],
  puestas: Set<TLInstancePresence['id']>,
): void {
  const vigentes = new Map(
    ajenas.map((ajena) => [InstancePresenceRecordType.createId(String(ajena.cliente)), ajena] as const),
  );
  const quitar = [...puestas].filter((id) => !vigentes.has(id));
  const ahora = Date.now();
  store.mergeRemoteChanges(() => {
    if (quitar.length > 0) store.remove(quitar);
    const registros = [...vigentes.values()].map((ajena) =>
      InstancePresenceRecordType.create({
        id: InstancePresenceRecordType.createId(String(ajena.cliente)),
        userId: createUserId(String(ajena.cliente)),
        userName: ajena.nombre,
        color: colorDe(ajena.cliente),
        currentPageId: ajena.pagina,
        selectedShapeIds: [...ajena.seleccion],
        lastActivityTimestamp: ahora,
        ...(ajena.cursor === null
          ? {}
          : { cursor: { x: ajena.cursor.x, y: ajena.cursor.y, type: 'default' as const, rotation: 0 } }),
      }),
    );
    if (registros.length > 0) store.put(registros);
  });
  puestas.clear();
  for (const id of vigentes.keys()) puestas.add(id);
}

/** Publica el cursor local y pinta el de los demás. Se cierra al desmontar. */
export function seguirPresencia(editor: Editor, canal: PresenciaDelLienzo): () => void {
  const puestas = new Set<TLInstancePresence['id']>();
  let reloj = 0;

  const publicar = () => {
    reloj = 0;
    const info = getDefaultUserPresence(editor.store, {
      id: createUserId(String(canal.propio)),
      name: '',
      color: colorDe(canal.propio),
      imageUrl: '',
      typeName: 'user',
      meta: {},
    });
    if (!info) return;
    const cursor =
      info.cursor && Number.isFinite(info.cursor.x) && Number.isFinite(info.cursor.y)
        ? { x: info.cursor.x, y: info.cursor.y }
        : null;
    canal.publicar(cursor, info.selectedShapeIds, info.currentPageId);
  };

  const programar = () => {
    if (reloj !== 0) return;
    // Un envío por movimiento, no uno por cada frame: si no, el socket de la sala se cae.
    reloj = window.setTimeout(publicar, 50);
  };

  const dejarDeOirElStore = editor.store.listen(programar, { source: 'user', scope: 'all' });
  const dejarDeOirLaPresencia = canal.alCambiar((estados) => {
    aplicarPresencias(editor.store, leerPresenciasAjenas(estados, canal.propio), puestas);
  });
  programar();

  return () => {
    if (reloj !== 0) clearTimeout(reloj);
    dejarDeOirElStore();
    dejarDeOirLaPresencia();
  };
}
