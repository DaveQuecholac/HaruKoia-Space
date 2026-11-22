# Plan — prueba de la réplica central

> **Plan detallado vigente (2026-11-17):** rama `dev/versiones-pizarra` — [plan-replica-central.md](../versiones-pizarra/plan-replica-central.md) y [analisis-replica-central.md](../versiones-pizarra/analisis-replica-central.md). Este archivo queda como índice histórico de la PdC 2.

Rama original de la nota: `dev/motor`. Decisión: [analisis-stack-powersync-react-native.md](./analisis-stack-powersync-react-native.md). Arquitectura: [v2](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

PowerSync y React Native ya están decididos. Este plan ya no vota el stack.

| Qué era | Cómo quedó |
|---|---|
| Probar si React Native entra (PdC 1) | **Retirada.** React Native entra. El siguiente documento, antes de H2, es el diseño de la app Expo. No se construye una app desechable para votar |
| Probar PowerSync con la réplica central (PdC 2) | **Sigue.** Va antes de H4. No es producto y no toca `apps/web`, `apps/host` ni `apps/orchestrator`. Al terminar se anota el resultado y se borra lo que no se adopte |

Cada paso se confirma en el chat antes de implementarlo.

## Antes de empezar la prueba

**Cerrado el 2026-11-17** en [analisis-replica-central.md](../versiones-pizarra/analisis-replica-central.md): qué sube (metadatos + snapshot + JSON), backend de escritura como proceso propio, JWT RS256 desde ese backend, buckets Postgres, carpeta `pruebas/replica-central/`. Partir de Space: `/home/davesq/Documents/IoKoia/space/apps/server/deploy/powersync/`.

## P2.1 — Réplica central en Docker

Postgres con replicación lógica (versión 11 o posterior, como pide PowerSync), PowerSync Service (`journeyapps/powersync-service`) y su almacén de buckets.

**Verificación.** PowerSync responde en `/probes/liveness` y replica una tabla de prueba.

## P2.2 — Backend de escritura mínimo

Recibe la cola de subida, acepta solo el token de host de la sala y escribe en Postgres de forma síncrona. Responde con éxito y la causa ante un rechazo, sin `4xx`, como recomienda PowerSync.

## P2.3 — Host con el SDK de Node

Un proceso con `@powersync/node` que escribe un commit de prueba en su SQLite.

## P2.4 — Lector

Una página que lee los commits de una sala sin pasar por el relay.

## Criterios

| # | Pasa si |
|---|---|
| 1 | El host escribe sin red y la cola sube al volver |
| 2 | Un cliente sin el token de host no puede escribir |
| 3 | El lector ve el commit sin pasar por el relay |
| 4 | Apagar el host no le quita el historial a quien lo lee |
| 5 | Un rechazo del backend se revierte en el host y deja la causa visible |

**Se mide y se anota:** tiempo de un commit hasta que lo ve el lector, y memoria de los contenedores en reposo.

## Al terminar

1. El resultado se anota, con cada criterio y cada medición.
2. Lo que la prueba enseñó se escribe en la v2.
3. Lo que no se adopte se borra.

## Qué no entra

- La app Expo y el enlace entre tldraw y Yjs (H2).
- Persistencia de la sala (H3).
- El esquema real de las tablas (H4).
- Autenticación real del token de lectura.
- Desplegar la réplica central en Makino Hara.
