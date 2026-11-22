-- Tablas de producto H4 (V6). Sustituyen el SoT de humo `commits_prueba` para el camino real.
-- F-R7: no toca el SQLite Yjs de H3.

CREATE TABLE IF NOT EXISTS commits (
  id TEXT PRIMARY KEY,
  actualizado_en BIGINT NOT NULL,
  borrado BOOLEAN NOT NULL DEFAULT false,
  sala TEXT NOT NULL,
  padre TEXT,
  mensaje TEXT NOT NULL,
  autor TEXT NOT NULL,
  participantes TEXT NOT NULL DEFAULT '[]',
  creado_en BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  actualizado_en BIGINT NOT NULL,
  borrado BOOLEAN NOT NULL DEFAULT false,
  estado_yjs_base64 TEXT NOT NULL,
  tablero_json TEXT NOT NULL,
  formato_de_tablero INTEGER NOT NULL
);

ALTER TABLE commits REPLICA IDENTITY FULL;
ALTER TABLE snapshots REPLICA IDENTITY FULL;

GRANT SELECT ON TABLE commits TO powersync_role;
GRANT SELECT ON TABLE snapshots TO powersync_role;
