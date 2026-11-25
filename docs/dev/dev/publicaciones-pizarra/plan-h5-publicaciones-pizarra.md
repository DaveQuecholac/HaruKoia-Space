# Plan de acción — H5 Publicaciones al repositorio

Rama: `dev/publicaciones-pizarra`.  
Análisis: [analisis-h5-publicaciones-pizarra.md](./analisis-h5-publicaciones-pizarra.md).  
**Estado.** **P0–P11 hechos (suites).** D-H5-1…5 cerradas. Cierre de producto: pendiente de que el chat apruebe el humo en [evidencia-h5-cierre.md](./evidencia-h5-cierre.md).

## Reglas de trabajo

1. Un paso → parar → verificar → pruebas de ese paso → explicar cómo verlo (si aplica).
2. Sin código de producto (`apps/**`, `packages/**`) hasta que el chat autorice P1.
3. Staging/commit de pizarra ya es H4; este plan no los reabre.
4. Materialización = **git** (D-H5-2). La réplica no sustituye el repo.
5. Variante de hoy = markdown determinista; la tubería debe admitir la variante IA después (H6) sin bifurcarse.
6. Solo el host publica; el camino real no arrastra mocks.
7. UI de estados (P8) **después** de escritura + push reales (P6–P7), como en H4 (acción antes que panel).

## Mapa

```text
P0   Rama + README + análisis + este plan
        │
P1   Contratos: documento, estados de push, sala↔repo, rutas
        │
P2   Delta réplica: documents (+ sync rules / backend)
        │
P3   Cola de trabajos de publicación en el host
        │
P4   Mecanismo genérico de publicación (variantes)
        │
P5   Variante determinista: markdown sin IA
        │
P6   Escritura en rutas propias del working tree
        │
P7   Git commit + push + remoto adelantado
        │
P8   Estados replicados + UI mínima
        │
P9   CLI: space host / status / update
        │
P10  Idempotencia de space update
        │
P11  E2E remoto git local + evidencia + cierre
```

---

## P0 — Rama y documentación — **hecho**

**Objetivo.** Dejar H5 escrita antes de código de producto.

**Archivos.**

| Pieza | Ruta |
|-------|------|
| Índice | `docs/dev/dev/publicaciones-pizarra/README.md` |
| Análisis | `docs/dev/dev/publicaciones-pizarra/analisis-h5-publicaciones-pizarra.md` |
| Plan | `docs/dev/dev/publicaciones-pizarra/plan-h5-publicaciones-pizarra.md` |

**Prohibido en P0:** `Write` / `edit` en `apps/**` o `packages/**`.

**Pruebas.** N/A de código. Verificación: `git branch --show-current` → `dev/publicaciones-pizarra`; existen los tres archivos.

**Definition of done del paso.**

1. Carpeta de rama con los mismos segmentos que la rama git.
2. Análisis cubre hereda / entra / no entra / D-H5-* / mecanismo / errores / DoD de épica.
3. Plan cubre P0–P11 con pruebas y DoD por paso.
4. D-H5-1…5 anotadas y promovidas a fijos.

**Estado.** Hecho (2026-11-22). Ajuste de orden P6–P8 y fijos el mismo día.

**Parar.** Pedir autorización de P1 (contratos).

---

## P1 — Contratos de dominio y esquema — **hecho**

**Objetivo.** H5-T1 (documents; attachments binarios aplazados a H6). Tipos: documento publicado, estados de push, vínculo sala↔repo, nombres/rutas bajo D-H5-5.

**Entregado.**

| Pieza | Ruta |
|-------|------|
| `IdentificadorDeDocumento` | `packages/domain/src/documento/identificador-de-documento/` |
| `EstadoDePush` | `packages/domain/src/documento/estado-de-push/` |
| `VarianteDePublicacion` | `packages/domain/src/documento/variante-de-publicacion/` |
| Rutas D-H5-5 | `packages/domain/src/documento/rutas-publicadas/` |
| `VinculoSalaRepo` | `packages/domain/src/documento/vinculo-sala-repo/` |
| `DocumentoPublicado` | `packages/domain/src/documento/documento-publicado/` |
| `FilaDeDocumento` | `packages/schema/src/documento/fila-de-documento.ts` |

**Convención de rutas.** `harukoia/publicado/<commitId>/tablero.json` y `…/documento.md`.

**Verificación.** domain 94 tests / schema 33 tests; typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

---

## P2 — Delta réplica: documents — **hecho**

**Objetivo.** Ampliar la réplica **ya cableada en H4** (commits/snapshots, backend, PowerSync host) con tabla/filas `documents` (+ sync rules). **No** rehacer M3 ni la PdC.

**Entregado.**

| Pieza | Ruta |
|-------|------|
| SQL + grants + REPLICA IDENTITY | `pruebas/replica-central/init/05-documents-h5.sql` |
| Apply | `pruebas/replica-central/apply-tablas-h5-documents.sh` |
| Sync rules `documents` | `pruebas/replica-central/sync-config.yaml` |
| Backend PUT/DELETE `documents` | `apps/backend-escritura/src/escribir-batch/` |
| Esquema cliente + espejo host | `apps/host/src/versionado/esquema-de-replica/`, `almacen-de-commits` (`guardarDocumento` / listar) |
| Client schema humo | `packages/pruebas-entre-procesos/.../esquema-cliente-replica.ts` |
| Humo P2 | `packages/pruebas-entre-procesos/.../humo-documents-p2.ts` (`humo:p2`) |

**Verificación.** Tests host (guardarDocumento) + backend (acepta host / rechaza sala ajena); `humo:p2` verde: escritura host → lectura PowerSync; rechazo sin token. **Parar.**

**Estado.** Hecho (2026-11-25). Nota: tras `CREATE TABLE documents`, reiniciar PowerSync si el lector no ve filas nuevas (stream / publication lag).

**Parar.** Pedir autorización de P3 (cola de publicación).

---

## P3 — Cola de publicación en el host — **hecho**

**Objetivo.** H5-T4. Encolar un trabajo ligado a un `Identificador<'commit'>`; persistir la cola en disco del host; reintentos.

**Entregado.**

| Pieza | Ruta |
|-------|------|
| Ruta del archivo | `apps/host/src/publicacion/archivo-de-la-cola/` → `data/cola-publicacion.json` |
| Trabajo | `apps/host/src/publicacion/trabajo-de-publicacion/` |
| Cola | `apps/host/src/publicacion/cola-de-publicacion/` (`encolar`, `procesarSiguiente`, `reintentar`) |

**Política de idempotencia.** Un commit no admite dos trabajos activos (`pendiente`/`en-proceso`) ni re-encolarse si ya está `publicado`. Tras `fallido`: `reintentar(id)` o un nuevo `encolar`. Al abrir, `en-proceso` interrumpido vuelve a `pendiente` con causa `proceso-interrumpido`. Procesador inyectable (P4).

**Verificación.** 14 tests host en `src/publicacion` verdes; typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Parar.** Pedir autorización de P4 (mecanismo genérico de publicación).

---

## P4 — Mecanismo genérico de publicación — **hecho**

**Objetivo.** H5-T5. Interfaz de variante de formato; registro de variantes; orquestación genérica.

**Entregado.**

| Pieza | Ruta |
|-------|------|
| Artefacto en memoria | `apps/host/src/publicacion/mecanismo/artefacto-de-publicacion.ts` |
| Plugin `VarianteDeFormato` + `EntradaDePublicacion` | `…/variante-de-formato.ts` |
| Registro | `…/registro-de-variantes.ts` |
| Orquestador → `ProcesadorDePublicacion` | `…/orquestar-publicacion.ts` |

**Contrato.** Cargador de entrada inyectable; consumidor de artefactos por defecto solo valida (P6 escribe). Variante nueva = `registro.registrar(plugin)`; la cola no se bifurca.

**Verificación.** 10 tests del mecanismo verdes; typecheck OK; capas genéricas sin string `determinista`. **Parar.**

**Estado.** Hecho (2026-11-25).

**Parar.** Pedir autorización de P5 (variante markdown determinista).

---

## P5 — Variante determinista (markdown) — **hecho**

**Objetivo.** H5-T6. Markdown a partir del commit: versión, participantes, fecha, notas/datos del tablero; **mismo input → mismos bytes**. Aún **sin** escribir al working tree (eso es P6).

**Entregado.**

| Pieza | Ruta |
|-------|------|
| Generador puro | `apps/host/src/publicacion/variantes/markdown-determinista/generar-markdown-determinista.ts` |
| Plugin | `…/markdown-determinista.ts` (`id: markdown-determinista`) |
| Snapshot + hash | `…/__snapshots__/`, SHA-256 del fixture fijado en test |

**Salida en memoria.** `documento.md` + `tablero.json` (rutas D-H5-5). Participantes y formas ordenados; sin red/IA.

**Verificación.** 7 tests verdes; typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Parar.** Pedir autorización de P6 (escritura en rutas propias).

---

## P6 — Escritura en rutas propias — **hecho**

**Objetivo.** H5-T8. Escribir markdown + JSON del tablero solo bajo el prefijo D-H5-5 en el working tree del checkout ligado a la sala (D-H5-4).

**Entregado.**

| Pieza | Ruta |
|-------|------|
| Escritura + allowlist en disco | `apps/host/src/publicacion/escritura/escribir-artefactos.ts` |
| Consumidor del orquestador | `crearConsumidorQueEscribe(vinculo)` |

**Comportamiento.** Valida con `comoRutaPublicada`; resuelve bajo `raizDelCheckout`; exige quedar dentro de `harukoia/publicado/…`. Fuera del prefijo → rechazo sin escribir. Docs manuales fuera del árbol no se tocan.

**Verificación.** 5 tests verdes (escritura, rechazo, no pisar manual, traversal, cola+variante→archivos). Typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Parar.** Pedir autorización de P7 (git commit + push).

---

## P7 — Git commit + push + remoto adelantado — **hecho**

**Objetivo.** H5-T9. Commit git de generados; push; si el remoto adelantó, resolver y reintentar. “Publicado” de verdad = este paso en verde (la UI llega en P8).

**Entregado.**

| Pieza | Ruta |
|-------|------|
| CLI git | `apps/host/src/publicacion/git/ejecutar-git.ts` |
| Commit + push + reintento | `…/publicar-en-git.ts` (`publicarEnGit`) |

**Comportamiento.** Solo rutas bajo `harukoia/publicado/…`. Sin remoto / sin repo → causa clara. Remoto adelantado → fetch + merge; en generados gana el local (commit nuevo); reintenta push. Sin red externa (tests con bare).

**Verificación.** 4 tests verdes (push OK, remoto adelantado, sin remoto, conflicto en generado). Typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Parar.** Pedir autorización de P8 (estados replicados + UI mínima).

---

## P8 — Estados replicados + UI mínima — **hecho**

**Objetivo.** H5-T7. Estados: en proceso, publicado, fallido (+ reintento). Visibles en la web del host; replicados. **Depende de P6–P7:** no mostrar “publicado” sin push real.

**Entregado.**

| Pieza | Ruta |
|-------|------|
| Acciones `publicar` / `reintentar-publicacion` | domain + `apps/host/.../publicar/` |
| Mensaje `estado-de-push` + historial con estados | `mensaje-de-sala` / codec |
| Tubería real en la acción | `correr-publicacion` → variante → disco → git |
| UI historial | `apps/web/.../historial-de-versiones` (Publicar / Reintentar / causa) |
| Palanca de fallo | `HARUKOIA_PUBLICAR_FALLA` en el host |

**Verificación.** Tests domain/host/web verdes; typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Cómo verlo en la app.** Host + web: Commitear una versión → en el historial, **Publicar al repo** → ver en proceso / publicado o fallido+causa → **Reintentar publicación** si falló (sin redibujar). Fallo forzado: `HARUKOIA_PUBLICAR_FALLA=mensaje` en el entorno del host.

**Parar.** Pedir autorización de P9 (CLI space).

---

## P9 — CLI `space host` / `status` / `update` — **hecho**

**Objetivo.** H5-T10. Dejar de ser stub (`apps/cli`).

**Entregado.**

| Comando | Comportamiento |
|---------|----------------|
| `space host` | Exige git en cwd; arranca `apps/host/src/main.ts` con ese checkout (D-H5-4) |
| `space status` | Rama vs `origin` (adelante/atrás) + conteo `harukoia/publicado/` |
| `space update` | `git pull` de `origin` (D-H5-2); lista generados presentes |

**Verificación.** 9 tests CLI verdes (update en clon, host sin git, help solo 3 comandos, status). Typecheck OK. **Parar.**

**Estado.** Hecho (2026-11-25).

**Cómo verlo.** Desde el checkout del proyecto:
`pnpm --filter @harukoia/cli space -- status` / `update` / `host`.

**Parar.** Pedir autorización de P10 (idempotencia de `space update`).

---

## P10 — Idempotencia de `space update`

**Objetivo.** H5-T11.

**Pruebas.**

- `space update` dos veces seguidas → segundo run sin diff en generados.
- Ya al día → exit 0 y mensaje claro, sin reescribir innecesariamente.

**Verificación.** Suite CLI. **Parar.**

**Definition of done del paso.**

1. DoD épica §2 cubierto por prueba automatizada.

**Estado.** Hecho (2026-11-25).

**Cómo verlo.** En el checkout del proyecto (p. ej. `apps/host` tras un publish):
`pnpm --filter @harukoia/cli space -- update` dos veces. La segunda debe decir
«Ya al día… no se reescribieron generados» y `harukoia/publicado/` sin cambios.

**Parar.** Pedir autorización de P11 (E2E y cierre).

---

## P11 — E2E, evidencia y cierre

**Objetivo.** H5-T12 + DoD de fase 1 §8.

**Checklist DoD.**

1. Quien no estuvo corre comando → tiene markdown + tablero.  
2. Comando ×2 no cambia nada.  
3. Remoto adelantado con reintento.  
4. Fallo visible + reintento sin redibujar.

**Pruebas.** Suite entre-procesos / E2E con remoto git local. Typecheck de paquetes tocados.

**Evidencia.** `evidencia-h5-cierre.md` en esta carpeta. Actualizar README de la rama y nota en `docs/fijos/fases/fase-1-modulos-y-tareas.md` § H5.

**Hecho cuando.** Chat aprueba el humo (checklist en la evidencia). **Parar.** Siguiente épica: H6 (otra rama).

**Estado.** Suites y evidencia escritas (2026-11-25). Humo de app: pendiente de OK del chat.

**Entregables.**

| Artefacto | Ruta |
|-----------|------|
| E2E remoto git local | `packages/pruebas-entre-procesos/src/publicacion/e2e-h5-git.test.ts` |
| Evidencia | [evidencia-h5-cierre.md](./evidencia-h5-cierre.md) |

**Parar.** Esperar aprobación del checklist de humo en la evidencia. No abrir H6 en esta rama.

---

## Qué no hace este plan

- Markdown con IA, PDF, Word (H6).
- Sala global (H7).
- Unirse a sala desde CLI (D-H5-3: fuera de v1).
- Despliegue de la réplica en Makino Hara (salvo pedido aparte).
- Construir app Expo.
- Rehacer la réplica central o el espejo de commits de H4.
