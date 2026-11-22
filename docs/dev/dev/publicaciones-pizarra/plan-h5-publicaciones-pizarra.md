# Plan de acción — H5 Publicaciones al repositorio

Rama: `dev/publicaciones-pizarra`.  
Análisis: [analisis-h5-publicaciones-pizarra.md](./analisis-h5-publicaciones-pizarra.md).  
**Estado.** **P0 hecho.** D-H5-1…5 cerradas (chat + fijos). P1+ pendiente de autorización explícita de esa rebanada.

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

## P1 — Contratos de dominio y esquema

**Objetivo.** H5-T1 (documents; attachments binarios aplazados a H6). Tipos: documento publicado, estados de push, vínculo sala↔repo, nombres/rutas bajo D-H5-5.

**Depende de.** D-H5-3…5 cerradas. Autorización del chat para empezar P1.

**Archivos esperados.**

| Dueño | Ruta orientativa |
|-------|------------------|
| Domain | `packages/domain/src/…` (documento, estado de push, rutas) |
| Schema | `packages/schema/src/…` (fila de document) |

Sin UI. Sin escritura a disco de proyecto ni git.

**Errores.**

| Error | Mitigación |
|-------|------------|
| Campos de H6 (PDF/Word) como obligatorios | Lista explícita “H5: documents + estado”; adjuntos binarios fuera o stub |
| Un archivo dios | Un asunto por carpeta (model-oriented-layout) |
| Confundir commit de pizarra con documento publicado | Identificadores tipados distintos |

**Pruebas.**

- Unitarias: construir/validar documento; estados solo los acordados.
- Tipado: no asignar `commit` a `documento` ni confundir estado de push con estado de sala.
- Rutas: helper rechaza paths fuera del prefijo D-H5-5.

**Verificación.** `pnpm --filter @harukoia/domain test` y `@harukoia/schema test`; typecheck. **Parar.**

**Definition of done del paso.**

1. Contratos compilando y con tests verdes.
2. Rutas/nombres viven en domain (host y CLI coincidirán).
3. Nada escrito aún en disco del proyecto ni en git.

---

## P2 — Delta réplica: documents

**Objetivo.** Ampliar la réplica **ya cableada en H4** (commits/snapshots, backend, PowerSync host) con tabla/filas `documents` (+ sync rules). **No** rehacer M3 ni la PdC.

Cubre lo que falta de H5-T2/T3 respecto a documents; el espejo y la cola de subida del host para commits ya existen.

**Archivos esperados.** SQL/sync en la estación de réplica de producto; `apps/backend-escritura`; espejo host según patrón H4 V6. No tocar `sala.sqlite` (Yjs).

**Errores.**

| Error | Mitigación |
|-------|------------|
| Reconstruir Postgres/PowerSync desde cero | Reusar compose y patrón H4; solo delta documents |
| Mezclar documents en `sala.sqlite` | Prohibido; espejo aparte |
| Invitado escribe documents | Backend rechaza no-host (mismo contrato H4) |

**Pruebas.**

- Insert de document como host → lector PowerSync lo ve.
- Escritura sin token de host → rechazo.
- Host apagado: lector sigue viendo documents ya subidos (espíritu V7).

**Verificación.** Suites host / backend / entre-procesos que toquen documents. **Parar.**

**Definition of done del paso.**

1. Document de prueba visible vía PowerSync sin pasar por el relay.
2. Invitado no puede escribir documents.

---

## P3 — Cola de publicación en el host

**Objetivo.** H5-T4. Encolar un trabajo ligado a un `Identificador<'commit'>`; persistir la cola en disco del host; reintentos.

**Archivos esperados.** Dueño en `apps/host` (carpeta de publicación / cola), sin UI.

**Errores.**

| Error | Mitigación |
|-------|------------|
| Cola pierde el trabajo al matar el host | Persistencia en disco; prueba de rearranque |
| Fallo del job borra el commit H4 | Prohibido; commit de pizarra intacto |
| Doble encolado silencioso | Política de idempotencia explícita en el paso |

**Pruebas.**

- Encolar → procesar → estado terminal.
- Matar el proceso a mitad → al rearrancar el job sigue o queda fallido con causa (sin silencios).
- Fallo del job **no** borra el commit de pizarra H4.

**Verificación.** Tests en `apps/host` (o paquete dueño). **Parar.**

**Definition of done del paso.**

1. Cola operable en pruebas sin UI.
2. Un commit H4 puede encolarse una vez (o con política de idempotencia explícita).

---

## P4 — Mecanismo genérico de publicación

**Objetivo.** H5-T5. Interfaz de variante de formato; registro de variantes; orquestación genérica.

**Errores.**

| Error | Mitigación |
|-------|------------|
| Tubería bautizada “soloMarkdown” | Nombres genéricos; variante = plugin |
| Hardcode de “determinista” en la capa genérica | Prueba de extensión con variante mock |

**Pruebas.**

- Variante mock registrada → la cola la invoca.
- Sin hardcode del nombre “determinista” en la capa genérica.
- Prueba de extensión documentada: agregar segunda variante mock no toca git ni CLI.

**Verificación.** Unitarias del mecanismo. **Parar.**

**Definition of done del paso.**

1. Existe un solo mecanismo; la variante es plugin.
2. Typecheck verde.

---

## P5 — Variante determinista (markdown)

**Objetivo.** H5-T6. Markdown a partir del commit: versión, participantes, fecha, notas/datos del tablero; **mismo input → mismos bytes**. Aún **sin** escribir al working tree (eso es P6).

**Errores.**

| Error | Mitigación |
|-------|------------|
| Markdown no determinista | Snapshot de string o hash en test |
| Llamadas a red / modelo | Prohibido en esta variante |

**Pruebas.**

- Fixture de commit → markdown fijo (snapshot de string o hash).
- Cambiar un campo del commit → markdown distinto.
- Sin llamadas a red / modelo.

**Verificación.** Suite domain o host de la variante. **Parar.**

**Definition of done del paso.**

1. Markdown determinista verificado en test.
2. No depende de proveedor de IA.

---

## P6 — Escritura en rutas propias

**Objetivo.** H5-T8. Escribir markdown + JSON del tablero solo bajo el prefijo D-H5-5 en el working tree del checkout ligado a la sala (D-H5-4).

**Errores.**

| Error | Mitigación |
|-------|------------|
| Escribir fuera del prefijo | Allowlist en domain; prueba de rechazo |
| Pisar docs manuales | Archivo de prueba fuera del árbol no cambia |

**Pruebas.**

- Escribe dentro del prefijo.
- Intento fuera del prefijo → rechazo.
- No modifica un archivo manual de prueba fuera del árbol.

**Verificación.** Tests con directorio temporal. **Parar.**

**Definition of done del paso.**

1. Allowlist efectiva.
2. Archivos generados listos para el paso git.

---

## P7 — Git commit + push + remoto adelantado

**Objetivo.** H5-T9. Commit git de generados; push; si el remoto adelantó, resolver y reintentar. “Publicado” de verdad = este paso en verde (la UI llega en P8).

**Errores.**

| Error | Mitigación |
|-------|------------|
| Sin remoto / sin checkout | Estado fallido con causa clara |
| Remoto adelantado | Detectar, traer, reintentar (DoD épica §3) |
| Conflicto en generado | Gana el generado del commit nuevo (v2) |

**Pruebas.**

- Remoto local bare: push OK; archivos en el remoto.
- Remoto adelantado (segundo commit en bare) → detecta, trae, reintenta, termina publicado.
- Sin remoto configurado → fallido con causa clara.

**Verificación.** Suite con repos temporales (sin red externa). **Parar.**

**Definition of done del paso.**

1. Push feliz path verde.
2. Remoto adelantado sin intervención manual (DoD épica §3).

---

## P8 — Estados replicados + UI mínima

**Objetivo.** H5-T7. Estados: en proceso, publicado, fallido (+ reintento). Visibles en la web del host; replicados. **Depende de P6–P7:** no mostrar “publicado” sin push real.

**Errores.**

| Error | Mitigación |
|-------|------------|
| UI de estados antes del camino real | Prohibido en este plan; P8 después de P7 |
| Reintento exige redibujar | Reintento desde fallido sin tocar el tablero |

**Pruebas.**

- Tras push OK → “publicado”.
- Tras fallo inyectado → “fallido” con causa.
- Reintento desde fallido sin redibujar el tablero.

**Verificación.** Tests host/web + humo manual breve en la app. **Parar.**

**Definition of done del paso.**

1. El usuario ve el estado y la causa en la app.
2. Reintento no exige volver a dibujar (DoD épica §4).

**Cómo verlo en la app.** Host + web: disparar publicación de un commit H4 → ver estado; forzar fallo (si hay palanca de prueba) → causa; reintentar.

---

## P9 — CLI `space host` / `status` / `update`

**Objetivo.** H5-T10. Dejar de ser stub (`apps/cli`).

| Comando | Comportamiento mínimo |
|---------|----------------------|
| `space host` | Arranca/registra host usando el checkout actual (D-H5-4) |
| `space status` | Reporta versión/estado local vs remoto git (mínimo viable; réplica al día es opcional/extra) |
| `space update` | Fetch/pull del remoto del proyecto; deja generados en el working tree (D-H5-2) |

**Errores.**

| Error | Mitigación |
|-------|------------|
| `space host` fuera de un git repo | Error claro |
| `space update` contra otro remoto / carpeta ajena | Opera sobre cwd; falla claro |

**Pruebas.**

- `space update` en clon limpio tras un push de prueba → aparecen markdown + JSON.
- `space host` fuera de un git repo → error claro.
- Help documenta solo los tres comandos (D-H5-3).

**Verificación.** Tests CLI + entre-procesos si aplica. **Parar.**

**Definition of done del paso.**

1. Los tres comandos hacen lo declarado (D-H5-3).
2. Quien no estuvo puede obtener archivos sin haber entrado a la sala.

---

## P10 — Idempotencia de `space update`

**Objetivo.** H5-T11.

**Pruebas.**

- `space update` dos veces seguidas → segundo run sin diff en generados.
- Ya al día → exit 0 y mensaje claro, sin reescribir innecesariamente.

**Verificación.** Suite CLI. **Parar.**

**Definition of done del paso.**

1. DoD épica §2 cubierto por prueba automatizada.

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

**Estado.** Pendiente.

---

## Qué no hace este plan

- Markdown con IA, PDF, Word (H6).
- Sala global (H7).
- Unirse a sala desde CLI (D-H5-3: fuera de v1).
- Despliegue de la réplica en Makino Hara (salvo pedido aparte).
- Construir app Expo.
- Rehacer la réplica central o el espejo de commits de H4.
