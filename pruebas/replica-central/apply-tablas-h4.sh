#!/usr/bin/env bash
# Aplica init/04-commits-snapshots-h4.sql al Postgres de la PdC/estación.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source .env 2>/dev/null || true
POSTGRES_USER="${POSTGRES_USER:-harukoia}"
POSTGRES_DB="${POSTGRES_DB:-harukoia}"
podman compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < init/04-commits-snapshots-h4.sql
echo "ok: tablas commits + snapshots"
