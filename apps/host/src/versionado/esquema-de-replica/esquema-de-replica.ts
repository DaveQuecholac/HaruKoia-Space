/**
 * Client schema PowerSync del grafo de commits (H4 / V6).
 * Columnas en snake_case alineadas a Postgres (init/04).
 * No es el documento Yjs de la sala.
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

export const esquemaDeReplica = new Schema({
  commits,
  snapshots,
});
