# Análisis — H5 Lo guardado llega al repositorio

Rama: `dev/publicaciones-pizarra`.  
Plan: [plan-h5-publicaciones-pizarra.md](./plan-h5-publicaciones-pizarra.md).  
Puerta previa: H4 cerrada — [versiones-pizarra](../versiones-pizarra/README.md).

## 1. Por qué esta épica

Historia (fase 1 §8):

> Guardo una versión, hago push, y alguien que no estuvo en la junta corre un comando y tiene los archivos en su repositorio.

H4 dejó versiones oficiales de la pizarra (commit, historial, checkout, réplica de historial). Todavía **no** hay publicación a archivos del proyecto ni entrega a quien no estuvo. Esa es la promesa del producto.

## 2. Qué hereda (no se reconstruye)

| Pieza | De dónde | Uso en H5 |
|-------|----------|-----------|
| Commit de pizarra (snapshot Yjs + JSON + padre + mensaje) | H4 | Unidad que se publica |
| Traductor tablero ↔ JSON | H4 / M9 | Archivo de tablero que entra al repo |
| Solo el host comitea / publica | v2; roles H1 | Validación en servidor |
| Réplica central + backend de escritura | PdC + H4 | Estado de push e historial; **no** sustituye git para materializar |
| SQLite de sala (Yjs) y de réplica local en host | H3 / H4 | Siguen separados del working tree de git |
| CLI stub `space` | `apps/cli` | Se implementa de verdad |
| Tabla conceptual `documents` / `attachments` | v2 §5 | Campos de documents se cierran aquí; attachments binarios (PDF/Word) son H6 |

## 3. Qué entra y qué no

**Entra (H5-T1…T12):**

1. Contrato de documento publicado y estados de push; vínculo sala ↔ repo.
2. Delta de réplica para `documents` (H4 ya cubrió commits/snapshots y gran parte de M3; no se rehace la estación).
3. Cola de trabajos de publicación en el host.
4. Mecanismo genérico de publicación con variantes de formato.
5. Variante **determinista**: markdown sin modelo, a partir del commit.
6. Escritura en rutas propias y declaradas del working tree.
7. Git commit + push, con remoto adelantado.
8. Estados replicados (en proceso, publicado, fallido, reintento) + UI mínima **después** del push real.
9. `space host`, `space status`, `space update`.
10. Idempotencia de la materialización.
11. Prueba E2E contra un remoto git local.

**No entra.**

| Tema | Por qué |
|------|---------|
| IA / secciones “bonitas” / PDF / Word | H6 |
| Sala global / clone en servidor | H7 |
| Unirse a una sala desde el CLI | **Cerrado D-H5-3:** no en v1 |
| App Expo | Otra autorización |
| Autenticación | Después |
| Ramificación del historial de pizarra | Fuera de la v1 |
| Que `space update` lea la réplica como fuente de archivos | Cerrado en D-H5-2: materializa desde **git** |

## 4. Decisiones

### Cerradas (2026-11-22) — chat + promovidas a fijos

| # | Tema | Decisión |
|---|------|----------|
| **D-H5-1** | ¿Git en el alcance inicial? | **Sí.** Commit + push + caso de remoto adelantado. Sin esto el DoD de H5 no se cumple. |
| **D-H5-2** | ¿De dónde materializa `space update`? | **Desde git** (pull / fetch del remoto del proyecto). La réplica sigue para historial y estado de push; no escribe el markdown en el disco del que no estuvo. |
| **D-H5-3** | Alcance del CLI en v1 | Solo `space host`, `space status`, `space update`. **No** unirse a sala desde el CLI. |
| **D-H5-4** | Cuándo se liga sala ↔ repo | Al arrancar el host **desde el checkout** del proyecto (`cwd` / `space host` en esa carpeta). No un wizard después de dibujar. |
| **D-H5-5** | Rutas de generados | Prefijo **`harukoia/publicado/…`**. Nunca pisar docs manuales fuera de ese árbol. |

Detalle en v2 §13 (cerrados H5) y fase 1 § H5. Código de producto (P1+) solo cuando el chat autorice esa rebanada.

## 5. Tres canales (no confundir)

| Canal | Qué | H5 |
|-------|-----|----|
| Sync en vivo | Yjs por relay | No se toca |
| Réplica | Host → Postgres/PowerSync | Se amplía con `documents` y estado de push |
| Push / git | Archivos en el repo del equipo | **Núcleo de H5** |

“Commitear” en la UI de H4 = versión de pizarra.  
“Push” en H5 = generar archivos + git commit + git push.  
`space update` = quien no estuvo trae esos archivos por git.

## 6. Mecanismo

```text
Mecanismo de la capacidad: publicar un commit de pizarra como artefacto(s)
  en el working tree del repo ligado a la sala, y entregar esos archivos
  al resto del equipo por git
Variantes de hoy: markdown determinista (sin modelo)
Variantes probables siguientes: markdown con IA (H6); PDF/Word como
  adjuntos del mismo commit (H6)
Módulo dueño: M11 Push (cola, variantes, estados). M14 Git escribe.
  M15 CLI materializa. Contratos en M2 (domain/schema)
Plugins: cada variante de formato produce sus archivos y metadatos de
  documento; no abre una tubería paralela
Prueba de extensión: agregar “markdown con IA” = nueva variante en la
  unión + manejador; la cola, git y CLI no se renombran ni se bifurcan
Patrón existente a extender: commit H4 como unidad; réplica host-only;
  CLI stub en apps/cli; nombres de archivo previstos en packages/domain
```

Prohibido: tubería “soloMarkdownH5” aparte de la de publicación; que invitados escriban en git o en la réplica; mezclar Yjs de sala con el working tree; materializar desde réplica saltándose git (contradice D-H5-2).

## 7. Flujo de una publicación

1. Hay un commit de pizarra (H4) en el host.
2. El host encola un trabajo de publicación ligado a ese commit.
3. La variante determinista produce markdown (bytes en memoria / artefacto).
4. Se escriben markdown + JSON del tablero solo bajo `harukoia/publicado/…`.
5. Git add/commit en el working tree; git push al remoto. Si el remoto adelantó: traer + reintentar.
6. Recién entonces el estado de push pasa a **publicado** (o **fallido** con causa) y se replica; la UI lo muestra.
7. Quien no estuvo, en su clon: `space update` (git) y tiene los archivos.
8. Correr `space update` otra vez no cambia el working tree (idempotencia).

Orden de implementación (plan): contratos → delta documents → cola → mecanismo → markdown → **escritura → git** → **estados/UI** → CLI → idempotencia → E2E. UI después del push real (mismo criterio que H4: acción antes que panel).

## 8. Errores previstos

| Error | Mitigación |
|-------|------------|
| Publicar sin checkout / sin remoto | Fallo explícito al push o al arrancar `space host`; estado fallido con causa |
| Remoto adelantado | Detectar, traer, reintentar (DoD §3) |
| Markdown no determinista | Prueba: mismo commit → mismo bytes |
| Escribir fuera de rutas propias | Allowlist de rutas en domain; pruebas de rechazo |
| Invitado dispara push | Solo host; validación en servidor |
| Confundir commit de pizarra con commit de git | Nombres y UI distintos; docs lo dejan fijo |
| `space update` contra otro remoto / otra carpeta | Opera sobre el cwd del checkout; falla claro si no es repo |
| Cola pierde el trabajo al matar el host | Persistencia de jobs en disco del host (detalle en P3) |
| Mezclar almacenes Yjs / réplica / git | Tres rutas; pruebas que no cruzan |

## 9. Definition of done (épica)

1. Alguien que no estuvo corre un comando y tiene el markdown y el tablero en su repositorio.
2. Correr el comando dos veces no cambia nada.
3. Un remoto adelantado se resuelve con reintento, sin intervención manual.
4. Un fallo de publicación se ve, dice la causa y se puede reintentar sin volver a dibujar.

## 10. Tensiones / abiertos que H5 no cierra

| Tema | Notas |
|------|-------|
| Detalle de archivos bajo `harukoia/publicado/` | Convención de nombres en P1 (domain) |
| Adjuntos PDF/Word | Tabla puede existir mínima; generación es H6 |
| Despliegue de réplica en Makino Hara | No bloquea la tubería local de H5 |
| `space status` detalle de “réplica al día” vs “remoto al día” | Mínimo viable en P9 |

## 11. Referencias

- [fase-1 §8](../../../fijos/fases/fase-1-modulos-y-tareas.md)
- [analisis-arquitectura-v2](../../../fijos/arquitectura/analisis-arquitectura-v2.md) §§5–8, 10, 13
- [modelado amenities](../../../fijos/amenities/modelado-amenities-harukoia.md) (push ≠ réplica ≠ sync)
- [analisis-h4](../versiones-pizarra/analisis-h4-versiones-pizarra.md)
- CLI actual: `apps/cli/src/main.ts` (solo ayuda)
