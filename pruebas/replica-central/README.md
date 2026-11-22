# Prueba desechable — réplica central

**No es producto.** No vive bajo `apps/`. No lo arranca `pnpm dev` de la raíz.

**PdC cerrada (2026-11-17).** Evidencia: [evidencia-replica-central.md](../../docs/dev/dev/versiones-pizarra/evidencia-replica-central.md). Esta carpeta queda como **referencia desechable** hasta que H4 adopte el patrón; no borrar sin autorización en el chat.

Diseño: [analisis-replica-central.md](../../docs/dev/dev/versiones-pizarra/analisis-replica-central.md).  
Plan: [plan-replica-central.md](../../docs/dev/dev/versiones-pizarra/plan-replica-central.md).  
Patrón Space (no copiar Nest): `/home/davesq/Documents/IoKoia/space/apps/server/deploy/powersync/`.

## Árbol

```text
pruebas/replica-central/
├── README.md                 este archivo
├── .env.example              plantilla (copiar a .env; .env no se comitea)
├── backend-escritura/        R3 — recibe la cola de subida; solo el host
├── host-harness/             R4 — @powersync/node escribe un commit de prueba
├── lector/                   R5 — lee sin pasar por el relay
├── keys/                     R1 — JWT local-dev (solo ejemplo; no secretos de prod)
└── tmp/                      SQLite y basura local de la prueba (gitignored)
```

## Arranque (R1)

En esta máquina no hay `docker` de sistema: se usa **Podman** con el plugin Compose (`podman compose`). Hace falta `docker-compose` en el `PATH` (p. ej. binario en `~/.local/bin`) y el socket de usuario: `systemctl --user enable --now podman.socket`.

```bash
cd pruebas/replica-central
cp -n .env.example .env
# Si no hay keys/local-dev.pem: openssl genrsa -out keys/local-dev.pem 2048
podman compose up -d
curl -sf http://127.0.0.1:18090/probes/liveness   # → 200
podman compose ps
```

Si el volumen de Postgres **ya existía** antes de `init/02-powersync-role.sh`:

```bash
./apply-replication.sh
```

Tabla de prueba (R2), si el volumen ya existía antes de `init/03-commits-prueba.sql`:

```bash
./apply-tabla-prueba.sh
podman compose restart powersync   # recarga sync-config.yaml
```

Backend de escritura (R3), proceso aparte en el puerto **18091**:

```bash
cd backend-escritura
pnpm run install:pdc    # --ignore-workspace (esta carpeta no es del monorepo)
pnpm test
pnpm start
# health: curl -sf http://127.0.0.1:18091/health
```

Host harness (R4) — escribe en `tmp/host-harness.db` y sube al backend:

```bash
cd host-harness
pnpm run install:pdc
pnpm test
pnpm run escribir
# OK si imprime: ok: fila en Postgres vía backend
```

Lector (R5) — ve el commit por PowerSync, sin orquestador:

```bash
cd lector
pnpm run install:pdc
pnpm test
COMMIT_ID=cmt_pdc_r4_… pnpm run leer
# OK si imprime: ok: criterios 3 y 4 + F-R6
```

Resistencia (R6) y batería completa:

```bash
cd host-harness && pnpm run resistencia
# desde pruebas/replica-central:
./scripts/bateria-pdc.sh
```

Apagar contenedores: `podman compose down` (el volumen `harukoia_pdc_pg_data` se conserva). El backend se apaga con Ctrl+C.

## Puertos (distintos a Space)

Para poder tener Space y esta PdC a la vez en la misma máquina:

| Servicio | Space (referencia) | Esta PdC |
|----------|--------------------|----------|
| Postgres en el host | `54329` | `54339` |
| PowerSync en el host | `18080` | `18090` |

## Qué no hacer

- No abrir ni escribir `apps/host/data/sala.sqlite` (documento Yjs de H3).
- No meter esta carpeta en `apps/`.
- No comitear `.env`, `tmp/`, volúmenes Docker ni claves privadas reales (`keys/*.pem` ya están en el `.gitignore`).
