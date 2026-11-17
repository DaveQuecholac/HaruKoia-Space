# Evidencia — PdC réplica central

Rama: `dev/versiones-pizarra`.  
Fecha de cierre: **2026-11-17**.  
Plan: [plan-replica-central.md](./plan-replica-central.md).  
Análisis: [analisis-replica-central.md](./analisis-replica-central.md).  
Código de la prueba: `pruebas/replica-central/`.

## Criterios (los cinco)

| # | Criterio | Resultado | Cómo se vio |
|---|----------|-----------|-------------|
| 1 | Host escribe sin red y la cola sube al volver | **Pasa** | `pnpm run resistencia`: corte simulado → 0 filas; al restaurar, Postgres + lector ven la fila |
| 2 | Sin token de host no se escribe | **Pasa** | POST con Bearer inventado → `200 {ok:false,causa:host-no-autorizado}` y 0 filas |
| 3 | Lector ve el commit sin relay | **Pasa** | `pnpm run leer` vio `cmt_pdc_r4_*` vía PowerSync; el código no usa `ORQUESTADOR_URL` ni `/relay/` |
| 4 | Host apagado: el historial sigue legible | **Pasa** | Tras R4 el harness no queda vivo; el lector de R5/R6 igual lee de la réplica |
| 5 | Rechazo del backend: se revierte y la causa se ve | **Pasa** | `sala-no-coincide` en log; 0 filas en Postgres; fila local ausente tras checkpoint |

Batería repetible: `pruebas/replica-central/scripts/bateria-pdc.sh` (verde el 2026-11-17).

## Mediciones (esta máquina, 2026-11-17)

| Qué | Valor |
|-----|--------|
| (a) Escritura local → observación en lector | ~**1396 ms** |
| (b) Memoria en reposo — Postgres | ~**47 MB** |
| (b) Memoria en reposo — PowerSync | ~**108 MB** |

No son SLO de producto; son referencia para H4/H5.

## Decisiones de diseño validadas por la PdC

| Decisión | Queda |
|----------|--------|
| D-R1 Metadatos + snapshot + JSON | **Adoptar** (en la PdC: columnas `snapshot_b64` / `tablero_json` a escala prueba) |
| D-R2 Backend de escritura = proceso propio | **Adoptar** |
| D-R3 JWT RS256 de lectura con claim `sala` | **Adoptar** (`auth.parameter('sala')` en sync streams) |
| D-R4 Buckets en Postgres `powersync_storage` | **Adoptar** |
| D-R5 Espejo ≠ Yjs H3; client schema | **Adoptar** |

## Qué se adopta vs qué es desechable

### Se adopta (patrón / config a reescribir en producto)

- Compose: Postgres 16 + `wal_level=logical` + PowerSync Service `1.27` + buckets Postgres.
- Sync config edition **3** con filtro por sala.
- Contrato de subida: batch `PUT`/`DELETE`, rechazo de host con **HTTP 200 + causa** (no 4xx opaco); 503 si Postgres cae.
- Emisor JWT junto al backend de escritura; JWKS en `service.yaml`.
- Layout: réplica **fuera** de `apps/` de producto hasta que H4/H5 fijen el paquete dueño.
- Separación: `sala.sqlite` (H3) nunca es el espejo PowerSync.

### Desechable (no copiar tal cual a producto)

| Pieza | Por qué |
|-------|---------|
| `pruebas/replica-central/backend-escritura/` | Servidor mínimo Node; en producto vive en su proceso/paquete definitivo |
| `pruebas/replica-central/host-harness/` | Harness; el host real cablea `@powersync/node` en `apps/host` |
| `pruebas/replica-central/lector/` | Script de lectura; la web/Expo usarán el SDK de cliente |
| Tabla `commits_prueba` | Esquema de humo; H4 cierra `commits` / `snapshots` reales |
| Claves `keys/local-dev.pem` | Solo PdC; no producción |
| Worker que carga `better-sqlite3` desde `apps/host` | Atajo de máquina sin `make`; en producto se declara la dep nativa |

**No se borra** la carpeta `pruebas/replica-central/` en R7: sirve de referencia hasta que H4 adopte y el chat autorice limpiar. Queda marcada como **no producto**.

## Puerta a H4

La PdC está **cerrada en verde**. El bloqueo de [plan-h4-versiones-pizarra.md](./plan-h4-versiones-pizarra.md) (“no V1+ hasta R7”) queda **levantado** cuando el chat confirme.

**Siguiente paso de producto:** **V0** — contratos de commit, snapshot y versión de formato JSON.

**Prohibido en este cierre:** código bajo `apps/**` / `packages/**` de H4 sin esa confirmación.
