#!/usr/bin/env bash
# Idempotente: rol de replicación + usuario de storage en un volumen ya creado.
set -euo pipefail
cd "$(dirname "$0")"

docker compose exec -T postgres psql -U harukoia -d harukoia < apply-replication.sql

docker compose exec -T postgres psql -U harukoia -d powersync_storage <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powersync_storage') THEN
    CREATE ROLE powersync_storage WITH LOGIN PASSWORD 'powersync';
  END IF;
END
$$;
GRANT CONNECT ON DATABASE powersync_storage TO powersync_storage;
GRANT CREATE ON DATABASE powersync_storage TO powersync_storage;
EOSQL

echo "OK: powersync_role + publication + powersync_storage"
