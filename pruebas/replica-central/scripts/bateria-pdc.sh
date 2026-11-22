#!/usr/bin/env bash
# Batería completa de la PdC (R1–R6). Salir ≠ 0 si algo falla.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="${HOME}/.local/bin:${PATH}"

echo "=== R1 health ==="
curl -sf "http://127.0.0.1:18090/probes/liveness" >/dev/null
podman compose exec -T postgres psql -U harukoia -d harukoia -tAc "SHOW wal_level" | grep -q logical
echo "✓ postgres + powersync"

echo "=== R3 health + units ==="
curl -sf "http://127.0.0.1:18091/health" >/dev/null
( cd backend-escritura && pnpm test )
echo "✓ backend"

echo "=== R4 path units ==="
( cd host-harness && pnpm test )
echo "✓ harness paths"

echo "=== R5 sin-orquestador ==="
( cd lector && pnpm test )
echo "✓ lector source"

echo "=== R4 escribir ==="
( cd host-harness && pnpm run escribir | tee /tmp/pdc-r4-out.txt )
COMMIT_ID=$(grep -oE 'cmt_pdc_r4_[a-z0-9_]+' /tmp/pdc-r4-out.txt | head -n1)
test -n "$COMMIT_ID"
echo "commit=$COMMIT_ID"

echo "=== R5 leer ==="
( cd lector && COMMIT_ID="$COMMIT_ID" pnpm run leer )
echo "✓ lector vio $COMMIT_ID"

echo "=== R6 resistencia ==="
( cd host-harness && pnpm run resistencia )

echo "=== medición (b) stats reposo ==="
podman stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' \
  replica-central-postgres-1 replica-central-powersync-1 || true

echo "=== BATERÍA OK ==="
