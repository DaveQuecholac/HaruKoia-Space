import { Schema, Table, column } from '@powersync/node';

/** Espejo de `commits_prueba` (R2). No es el esquema final de H4. */
const commits_prueba = new Table({
  sala: column.text,
  mensaje: column.text,
  autor: column.text,
  participantes: column.text,
  creado_en: column.text,
  snapshot_b64: column.text,
  tablero_json: column.text,
  actualizado_en: column.text,
});

export const esquemaDePrueba = new Schema({
  commits_prueba,
});
