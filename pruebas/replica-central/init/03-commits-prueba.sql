-- Tabla mínima de la PdC (R2). No es el esquema final de H4.
-- D-R1 a escala reducida: metadatos + payloads de snapshot y JSON.
-- F-R7: no toca el SQLite Yjs de H3.

CREATE TABLE IF NOT EXISTS commits_prueba (
  id TEXT PRIMARY KEY,
  sala TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  autor TEXT NOT NULL,
  participantes TEXT NOT NULL DEFAULT '[]',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_b64 TEXT NOT NULL DEFAULT '',
  tablero_json TEXT NOT NULL DEFAULT '{}',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commits_prueba REPLICA IDENTITY FULL;

GRANT SELECT ON TABLE commits_prueba TO powersync_role;
