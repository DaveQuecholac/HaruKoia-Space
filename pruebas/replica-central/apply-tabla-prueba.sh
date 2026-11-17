#!/usr/bin/env bash
# Aplica init/03-commits-prueba.sql en un volumen que ya existía (R2).
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T postgres psql -U harukoia -d harukoia < init/03-commits-prueba.sql
echo "OK: commits_prueba"
