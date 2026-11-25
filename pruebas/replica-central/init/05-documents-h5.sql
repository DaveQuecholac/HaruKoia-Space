-- Tabla de producto H5 (P2): documents (estado de push + rutas).
-- Delta sobre commits/snapshots de H4. Sin attachments (H6).
-- F-R7: no toca el SQLite Yjs de H3.

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  actualizado_en BIGINT NOT NULL,
  borrado BOOLEAN NOT NULL DEFAULT false,
  sala TEXT NOT NULL,
  commit_id TEXT NOT NULL,
  variante TEXT NOT NULL,
  estado_tipo TEXT NOT NULL,
  estado_causa TEXT,
  estado_marca BIGINT,
  ruta_directorio TEXT NOT NULL,
  ruta_tablero_json TEXT NOT NULL,
  ruta_documento_markdown TEXT NOT NULL,
  creado_en BIGINT NOT NULL
);

ALTER TABLE documents REPLICA IDENTITY FULL;

GRANT SELECT ON TABLE documents TO powersync_role;
