# Rama `dev/versiones-pizarra`

Puerta de **réplica central** (antes de H4) y épica **H4 — Guardo una versión y vuelvo a ella**.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-replica-central.md](./analisis-replica-central.md) | Diseño de la réplica: qué sube, backend de escritura, token, buckets, esquema |
| [plan-replica-central.md](./plan-replica-central.md) | Pasos de la prueba (PdC), con errores, pruebas y verificación |
| [analisis-h4-versiones-pizarra.md](./analisis-h4-versiones-pizarra.md) | Staging, commit, historial, checkout, traductor |
| [plan-h4-versiones-pizarra.md](./plan-h4-versiones-pizarra.md) | Pasos de H4, con errores, pruebas y verificación |
| [evidencia-replica-central.md](./evidencia-replica-central.md) | Cierre de la PdC: criterios, mediciones, qué se adopta |

Épicas: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).  
Arquitectura: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).  
H3 cerrada: [docs/dev/dev/persistencia-sala/](../persistencia-sala/README.md).  
Patrones Space: [referencia-space-powersync-sqlite-secrets.md](../../../fijos/referencia-space-powersync-sqlite-secrets.md).  
Borrador previo de la PdC (sigue válido como índice corto): [plan-pdc-stack-powersync-react-native.md](../motor/plan-pdc-stack-powersync-react-native.md).

## Orden de trabajo

```text
R0…R7   Prueba de la réplica central (no es producto)
   │
   ▼  resultado anotado; lo no adoptado se borra
V0…V9   H4: traductor, staging, commit, historial, checkout, réplica del historial
```

La PdC cerró en verde (R7, 2026-11-17). **H4 (V0)** espera confirmación en el chat antes del primer código de producto.

## Alcance

**Entra.** Diseño y prueba desechable de la réplica central. Luego staging de **toda la pizarra**, commit con snapshot Yjs + JSON, historial, checkout, y lectura del historial vía PowerSync.

**No entra.** Ramificación. Publicación al repo / CLI / git (H5). IA (H6). Sala global (H7). App Expo. Autenticación de producto. Despliegue de la réplica en Makino Hara (la PdC es local). Orquestador como almacén de datos.

## Estado

> **PdC cerrada (R7, 2026-11-17).** Criterios 1–5 en verde. Siguiente: **V0 de H4** (contratos), cuando el chat lo confirme.

| Paso | Qué | Estado |
|------|-----|--------|
| P0 | Rama y esta carpeta | Hecho |
| R0 | Andamio `pruebas/replica-central/` | Hecho |
| R1 | Postgres + PowerSync | Hecho |
| R2 | Tabla + sync rules | Hecho |
| R3 | Backend de escritura | Hecho |
| R4 | Host harness | Hecho |
| R5 | Lector sin relay | Hecho |
| R6 | Resistencia | Hecho |
| R7 | Evidencia / puerta H4 | Hecho |
| V0–V9 | H4 versiones | Pendiente — **puerta abierta** tras confirmar en chat |

## Decisiones cerradas en esta rama (2026-11-17)

| # | Tema | Decisión |
|---|------|----------|
| D-R1 | Qué sube a la réplica | Metadatos del commit **y** snapshot Yjs **y** JSON del tablero |
| D-R2 | Backend de escritura | **Proceso propio** junto a la réplica; no dentro del orquestador |
| D-R3 | Token de lectura | JWT RS256 emitido por el backend de escritura (en la PdC: clave local-dev) |
| D-R4 | Almacén de buckets | Postgres `powersync_storage` en el mismo host, sin Mongo |
| D-R5 | Esquema cliente vs H0 | El espejo PowerSync usa client schema / views; no migrar el archivo sync. El Yjs de H3 sigue en su SQLite aparte |
| D-H4-1 | Qué entra en staging | **Toda la pizarra** en cada commit. Sin selección por elementos ni marcos en la v1 |

Detalle y razones: en los dos análisis. Promovidas a `docs/fijos/` en el mismo arranque documental.

## Fuera de esta rama

- Si git entra en el alcance inicial (sigue abierto; bloquea forma de H5, no la PdC).
- `space update` desde git o desde la réplica (H5).
- Diseño de pantallas Expo (otra autorización).
