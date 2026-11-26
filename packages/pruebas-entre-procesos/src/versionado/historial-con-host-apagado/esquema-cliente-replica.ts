/**
 * Client schema PowerSync del historial (H4 / V7) + documents (H5 / P2).
 * Misma forma que el espejo del host; solo lectura en este camino.
 */
import { Schema, Table, column } from '@powersync/node';

const commits = new Table({
  actualizado_en: column.integer,
  borrado: column.integer,
  sala: column.text,
  padre: column.text,
  mensaje: column.text,
  autor: column.text,
  participantes: column.text,
  creado_en: column.integer,
});

const snapshots = new Table({
  actualizado_en: column.integer,
  borrado: column.integer,
  estado_yjs_base64: column.text,
  tablero_json: column.text,
  formato_de_tablero: column.integer,
});

const documents = new Table({
  actualizado_en: column.integer,
  borrado: column.integer,
  sala: column.text,
  commit_id: column.text,
  variante: column.text,
  estado_tipo: column.text,
  estado_causa: column.text,
  estado_marca: column.integer,
  ruta_directorio: column.text,
  ruta_tablero_json: column.text,
  ruta_documento_markdown: column.text,
  creado_en: column.integer,
});

export const esquemaClienteDeReplica = new Schema({
  commits,
  snapshots,
  documents,
});
