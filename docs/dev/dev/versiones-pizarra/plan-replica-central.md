# Plan de acción — Prueba de la réplica central

Rama: `dev/versiones-pizarra`.  
Análisis: [analisis-replica-central.md](./analisis-replica-central.md).

## Reglas de trabajo

1. **Un paso → parar → verificar → pruebas de ese paso.** No encadenar sin checkpoint en el chat.
2. Ningún paso se da por terminado solo porque Docker “está up”.
3. **No** tocar `apps/web`, `apps/host`, `apps/orchestrator` en esta PdC.
4. Partir del compose de Space (`/home/davesq/Documents/IoKoia/space/apps/server/deploy/powersync/`); adaptar puertos y nombres a HaruKoia, no inventar Mongo.
5. Dependencias solo con el gestor del repo dentro de la carpeta de la prueba.
6. Cada paso confirma en chat antes de codear el siguiente.

## Mapa

```text
P0   Rama y docs (hecho)
  │
R0   Carpeta pruebas/replica-central + .gitignore de volúmenes
  │
R1   Postgres + PowerSync (compose) vivos
  │
R2   Tabla de prueba + replicación lógica
  │
R3   Backend de escritura mínimo (solo host)
  │
R4   Host harness @powersync/node escribe un commit de prueba
  │
R5   Lector ve el commit sin relay
  │
R6   Resistencia: sin red, rechazo, host apagado
  │
R7   Evidencia, mediciones, promover o borrar; puerta a H4
```

---

## P0 — Rama y documentación

**Objetivo.** Dejar el diseño escrito antes de Docker.

**Hecho cuando.**

- `git branch --show-current` → `dev/versiones-pizarra`
- Existen README, este plan y el análisis de réplica

**Prohibido en P0:** código bajo `pruebas/` o `apps/`.

**Estado.** Hecho (2026-11-17).

---

## R0 — Andamio de la prueba

**Objetivo.** Crear `pruebas/replica-central/` con README de arranque, `.env.example` y exclusión de volúmenes en `.gitignore`. Sin contenedores todavía.

**Archivos esperados.** `pruebas/replica-central/README.md`, `.env.example`, entradas en `.gitignore` del repo o local.

**Errores a cubrir.**

| Error | Cómo se evita / se detecta |
|-------|----------------------------|
| Meter la PdC en `apps/` | Layout fijado en el análisis; el README de la raíz de pruebas lo dice |
| Comitear secretos o volúmenes | `.gitignore`; claves local-dev solo como ejemplo |

**Pruebas / verificación.**

- `ls pruebas/replica-central` muestra la estructura acordada
- `git check-ignore` sobre un path de volumen de ejemplo confirma exclusión

**Hecho cuando.** Estructura revisada en chat. **Parar.**

**Estado.** Hecho (2026-11-17). Verificación: `ls` del árbol y `git check-ignore` sobre `.env`, `tmp/x.db` y `keys/local-dev.pem`.

---

## R1 — Postgres y PowerSync Service

**Objetivo.** `docker compose up` con Postgres (`wal_level=logical`) y PowerSync Service; liveness OK. Buckets en Postgres `powersync_storage` (D-R4).

**Cómo.** Adaptar el compose de Space: imagen pinneada, init de rol de replicación, `service.yaml` + JWKS local-dev. Puertos **distintos** a los de Space si ambas pruebas pueden coexistir en la misma máquina (anotar en el README).

**Errores a cubrir.**

| Error | Cómo se detecta | Qué hacer |
|-------|-----------------|-----------|
| Postgres sin logical decoding | PowerSync no replica | Init/script `apply-replication`; verificar `wal_level` |
| Volumen viejo sin rol | Contenedor unhealthy | Documentar `./apply-replication.sh` como Space |
| SELinux / binds en Fedora | Compose falla al montar | Usar `:Z` como Space |
| Puerto ocupado | Bind error | Cambiar puerto en `.env` de la prueba |

**Pruebas / verificación.**

- `docker compose ps` → postgres y powersync healthy
- `curl` a `/probes/liveness` de PowerSync → 200
- Log de PowerSync sin error de storage al arrancar

**Hecho cuando.** Liveness en verde dos veces seguidas tras `down`/`up`. **Parar.**

**Estado.** Hecho (2026-11-17). En esta máquina: Podman + `docker-compose` en `~/.local/bin`. Tras `down`/`up`, `/probes/liveness` → 200 dos veces; `wal_level=logical`; bases `harukoia` y `powersync_storage`; logs sin error de storage.

---

## R2 — Tabla de prueba y sync rules

**Objetivo.** Una tabla mínima (p. ej. `commits_prueba` o smoke) en el Postgres de app, publicación a PowerSync (edition 3), visible en sync config.

**Errores a cubrir.**

| Error | Cómo se detecta |
|-------|-----------------|
| Tabla sin `REPLICA IDENTITY` adecuada | Filas no llegan al cliente |
| Stream mal nombrado | Cliente conecta y ve 0 filas |
| Incluir tablas de system / Yjs H3 | Revisión del yaml: solo tablas de la PdC |

**Pruebas / verificación.**

- Insert manual SQL de una fila
- Tras un breve wait, el harness o un query interno de PowerSync confirma que el stream la ve (o el paso R5 lo cerrará; en R2 basta insert + config validada por el servicio sin crash)

**Hecho cuando.** Config cargada; insert de humo sin tumbar PowerSync. **Parar.**

**Estado.** Hecho (2026-11-17). Tabla `commits_prueba` con `REPLICA IDENTITY FULL`; stream en `sync-config.yaml`; insert `cmt_pdc_humo_001`. Logs: `Replicating "public"."commits_prueba"` y `Flushed 1 … updates`; liveness 200.

---

## R3 — Backend de escritura mínimo

**Objetivo.** HTTP que recibe la cola de subida de PowerSync, escribe en Postgres **síncrono**, acepta solo el **token de host** de la sala de prueba, y ante rechazo responde con éxito+causa (contrato recomendado por PowerSync), no un `4xx` opaco que deje la cola a ciegas.

**Decisiones aplicadas.** D-R2 (proceso propio), D-R3 (emite también JWT de lectura para el lector).

**Errores a cubrir.**

| Código | Caso | Esperado |
|--------|------|----------|
| F-R1 / F-R2 | Sin token o token de otro | No escribe; causa en respuesta |
| — | Token de host correcto | Fila en Postgres |
| — | Caída de Postgres a mitad | Error visible; sin fila a medias (transacción) |

**Pruebas.**

- Unitarias del validador de host junto al backend
- Script o test: POST con token malo → Postgres sin fila
- POST con token bueno → fila presente

**Verificación.** Logs del backend muestran rechazo y aceptación. **Parar.**

**Estado.** Hecho (2026-11-17). `backend-escritura` en `:18091`. Pruebas del validador 3/3. Token malo → `200 {ok:false,causa:host-no-autorizado}` y 0 filas; token bueno → fila `cmt_pdc_r3_ok_001`. `GET /sync/bootstrap` emite JWT. Logs: `rechazo` y `aceptada`.

---

## R4 — Host harness con `@powersync/node`

**Objetivo.** Proceso Node que abre SQLite PowerSync, escribe un “commit de prueba” (id, sala, mensaje, payload mínimo que simule snapshot+json según D-R1 a escala reducida), y sube por `uploadData` al backend de R3.

**Errores a cubrir.**

| Error | Cómo se detecta |
|-------|-----------------|
| Binarios core de PowerSync Node faltan | Fallo al abrir DB → correr `download_core.js` documentado |
| `uploadData` no cableado | Cola no vacía; Postgres vacío |
| Escribir en el mismo archivo que H3 `sala.sqlite` | Prohibido; path bajo `pruebas/replica-central/tmp/` |

**Pruebas.**

- Arrancar harness → fila en Postgres vía backend
- Typecheck / test del harness si aplica

**Verificación.** Una corrida manual documentada en el README de la prueba. **Parar.**

**Estado.** Hecho (2026-11-17). `pnpm run escribir` → SQLite en `tmp/host-harness.db` (no `sala.sqlite`); `uploadData` al backend; fila `cmt_pdc_r4_*` en Postgres. Prueba de ruta 2/2. `better-sqlite3` se carga desde `apps/host` (sin compilar nativo en la PdC).

---

## R5 — Lector sin relay

**Objetivo.** Cliente (script Node con SDK o página mínima **fuera** de `apps/web`) que obtiene JWT de lectura (D-R3), se conecta a PowerSync y ve el commit de R4. **Cero** WebSocket al orquestador.

**Errores a cubrir.**

| Código | Caso | Esperado |
|--------|------|----------|
| F-R6 | JWT de otra sala | No ve la fila |
| — | JWT bueno | Ve id y payload del commit |
| F-R4 | Matar el harness host | El lector **sigue** viendo lo ya syncado |

**Pruebas.**

- Test o script automatizable: escribe (R4) → lee (R5) → assert
- Assert de que no hay variable `ORQUESTADOR_URL` en el camino del lector

**Verificación.** Criterios PdC 3 y 4. **Parar.**

**Estado.** Hecho (2026-11-17). Stream filtrado con `auth.parameter('sala')`. Lector ve `cmt_pdc_r4_*` sin harness ni orquestador; JWT de otra sala no ve la fila (F-R6). Test `sin-orquestador` 1/1.

---

## R6 — Resistencia de la PdC

**Objetivo.** Cumplir criterios 1, 2 y 5 con evidencia.

| Caso | Pasos | Pasa si |
|------|-------|---------|
| Sin red (criterio 1) | Cortar salida del harness hacia el backend; escribir; restaurar red | Cola sube; lector ve el valor |
| Intruso (criterio 2) | Cliente con token inventado llama upload | Postgres sin esa fila |
| Rechazo (criterio 5) | Backend fuerza rechazo; host hace checkpoint | Escritura revertida o marcada; causa en log |

**Errores.** F-R1, F-R2, F-R3.

**Mediciones.** Anotar: (a) ms desde escritura local hasta observación en lector con red sana; (b) `docker stats` en reposo una vez.

**Hecho cuando.** Los cinco criterios del análisis están en verde. **Parar.**

**Estado.** Hecho (2026-11-17). `pnpm run resistencia` + `scripts/bateria-pdc.sh` en verde. Criterios 1–5 OK. Medición (a) ~1396 ms escritura→lector en esta máquina; (b) postgres ~47 MB, powersync ~108 MB en reposo.

---

## R7 — Cierre de la PdC y puerta a H4

**Objetivo.** Escribir `evidencia-replica-central.md` con criterios, mediciones y qué se adopta. Actualizar este plan y el README de la rama. Borrar o marcar lo desechable que no se adoptará. Confirmar en chat: **H4 puede empezar (V0)**.

**Prohibido.** Empezar código de producto H4 en el mismo cambio que R7 sin autorización explícita.

**Hecho cuando.** Evidencia mergeable en la carpeta de la rama y el chat confirma el paso a H4.

**Estado.** Hecho (2026-11-17). Evidencia en [evidencia-replica-central.md](./evidencia-replica-central.md). Lo desechable quedó **marcado** (no borrado): `pruebas/replica-central/` sigue como referencia. **H4 (V0) puede empezar** cuando el chat lo confirme.

---

## Qué no hace este plan

- Commits reales de pizarra, staging UI, checkout (plan H4).
- Despliegue Coolify de la réplica.
- Cambiar el orquestador.
