# Rama `dev/publicaciones-pizarra`

Épica **H5 — Lo guardado llega al repositorio de quien no estuvo**: publicar una versión de la pizarra como archivos en el repo del proyecto, con git push y CLI `space update`.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h5-publicaciones-pizarra.md](./analisis-h5-publicaciones-pizarra.md) | Qué hereda de H4, entra/no entra, decisiones D-H5-*, mecanismo, errores, DoD |
| [plan-h5-publicaciones-pizarra.md](./plan-h5-publicaciones-pizarra.md) | Pasos P0–P11 con pruebas, verificación y definition of done por paso |

Épicas: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).  
Arquitectura: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).  
H4 cerrada: [docs/dev/dev/versiones-pizarra/](../versiones-pizarra/README.md).  
H3 cerrada: [docs/dev/dev/persistencia-sala/](../persistencia-sala/README.md).

## Orden de trabajo

```text
P0    Rama y esta carpeta (docs)
  │
P1    Contratos: documento publicado, estados de push, sala↔repo
  │
P2    Delta réplica: tabla documents (+ sync) sobre lo de H4
  │
P3    Cola de trabajos de publicación en el host
  │
P4    Mecanismo genérico de publicación (variantes)
  │
P5    Variante determinista: markdown sin IA
  │
P6    Escritura en rutas propias del working tree
  │
P7    Git commit + push + remoto adelantado
  │
P8    Estados replicados + UI mínima (después del push real)
  │
P9    CLI: space host / status / update
  │
P10   Idempotencia de space update
  │
P11   E2E, evidencia, cierre H5
```

## Alcance

**Entra.** Publicación a partir de un commit de H4: markdown determinista, JSON del tablero en rutas propias, git commit y push al remoto del proyecto, estados de push visibles, CLI `space host`, `space status` y `space update` (materializa desde git).

**No entra.** IA, PDF ni Word (H6). Sala global / host en servidor (H7). Unirse a una sala desde el CLI. App Expo. Autenticación. Ramificación del historial de pizarra.

## Estado

> **P0 hecho (2026-11-22).** Carpeta de rama con análisis y plan. D-H5-1…5 cerradas y promovidas a fijos. Sin código de producto hasta que el chat autorice P1.

| Paso | Qué | Estado |
|------|-----|--------|
| P0 | Rama y esta carpeta | **Hecho** |
| P1 | Contratos domain/schema | Pendiente |
| P2 | Documents en réplica (delta) | Pendiente |
| P3 | Cola de publicación | Pendiente |
| P4 | Mecanismo + variantes | Pendiente |
| P5 | Markdown determinista | Pendiente |
| P6 | Rutas en working tree | Pendiente |
| P7 | Git commit/push | Pendiente |
| P8 | Estados + UI | Pendiente |
| P9 | CLI space | Pendiente |
| P10 | Idempotencia update | Pendiente |
| P11 | E2E + cierre | Pendiente |

## Decisiones cerradas (2026-11-22)

| # | Tema | Decisión |
|---|------|----------|
| D-H5-1 | ¿Git en el alcance? | **Sí:** commit + push + manejo de remoto adelantado |
| D-H5-2 | ¿De dónde materializa `space update`? | **Desde git** (pull del remoto del proyecto) |
| D-H5-3 | Alcance del CLI | Solo `space host`, `space status`, `space update`. No unirse a sala |
| D-H5-4 | Vínculo sala↔repo | Al arrancar el host desde el checkout del proyecto |
| D-H5-5 | Rutas generadas | Prefijo `harukoia/publicado/…` |

Promovidas en v2 §13 y fase 1 § H5. P1 queda pendiente de autorización explícita en el chat (una rebanada).

## Fuera de esta rama

- Proveedor de IA y secciones del markdown “bonito” (H6).
- Host en servidor / sala global (H7).
- Limpiar `pruebas/replica-central/` (sigue de referencia).
