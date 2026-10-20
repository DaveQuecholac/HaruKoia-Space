# Plan — Pruebas de concepto de React Native y PowerSync

Rama: `dev/motor`. Análisis y decisión: [analisis-stack-powersync-react-native.md](./analisis-stack-powersync-react-native.md). Arquitectura: [v2, revisión del 2026-10-19](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

Dos pruebas de concepto (PdC) para decidir con datos lo que la revisión del stack dejó abierto. **No son producto**: no tocan `apps/web`, `apps/host` ni `apps/orchestrator`. Al terminar se registra el resultado y se borra lo que no se adopte. Este plan es una propuesta: cada paso se confirma en el chat antes de implementarlo.

| PdC | Pista | Va antes de | Decide |
|---|---|---|---|
| **PdC 1** — tldraw en Expo con una sala real | B | H2 | S4: si React Native entra en la v1. S5: cómo se arranca Expo |
| **PdC 2** — PowerSync con la réplica central | A | H4 | Que la opción D funciona, y da datos para S2, S3, S6 y S7 |

Las dos se pueden hacer en paralelo.

---

## P0 — Dónde viven

**Bloquea las dos PdC. Decisión S10, la toma David.**

Hay que decidir la rama (por ejemplo una propia por PdC, o esta misma) y la carpeta. La carpeta tiene que dejar claro que no es producto, y no puede ser un `apps/` nuevo que el arranque de la raíz trate como una app. Si la PdC va en otra rama, este plan se mueve a la carpeta de documentación de esa rama.

**Hecho cuando.** La rama y la carpeta están escritas aquí.

---

## PdC 1 — tldraw en Expo conectado a una sala real

### P1.1 — App Expo mínima en el monorepo

Expo con pnpm y dependencias aisladas, como pide su guía de monorepos (SDK 54 o posterior).

**Verificación.** La app abre en web y en un teléfono con un build de desarrollo.

### P1.2 — Los paquetes del motor desde Expo

Importar `@harukoia/domain` y `@harukoia/cliente-del-relay` sin copiarlos.

Qué se comprueba:
- Que Metro resuelve los `exports` que apuntan a `src/index.ts` y los imports con extensión `.ts`.
- Que `crypto.getRandomValues` (identificadores) existe en el teléfono, o qué polyfill hace falta.
- Que el `WebSocket` del teléfono maneja el saludo del relay y los mensajes binarios.

**Hecho cuando.** Cada punto queda anotado como funciona o con lo que necesitó.

### P1.3 — Entrar a una sala real

Pantalla de nombre y de unirse, con el proveedor de Hocuspocus sobre `cliente-del-relay`, contra el orquestador de Makino Hara y un host corriendo con `pnpm dev`.

**Verificación.** El teléfono aparece en la lista de participantes de la web, con su nombre.

### P1.4 — tldraw en un componente DOM

tldraw dentro de un componente con `'use dom'`, conectado al documento de la sala. **El enlace entre tldraw y Yjs de la PdC es desechable**: el de verdad se diseña en el análisis de H2.

**Verificación.** Un trazo hecho en la web aparece en el teléfono, y uno del teléfono aparece en la web.

### P1.5 — Link de invitación en el teléfono

`https://<web>/s/<sala>#<token>` abre la sala en la app, con el token intacto.

### P1.6 — Arranque con PM2 y portless

Probar si Metro toma su puerto del entorno, como Vite hoy, sin pasarle banderas. Si no se puede sin tocar el kit de `scripts/`, se reporta: la regla prohíbe editarlo para un arreglo puntual.

### Criterios de la PdC 1

| # | Pasa si |
|---|---|
| 1 | Los trazos cruzan en los dos sentidos entre web y teléfono, por Makino Hara |
| 2 | La misma app corre en web |
| 3 | El link abre la sala en el teléfono |
| 4 | `domain` y `cliente-del-relay` se usan sin copiarlos |

**Se mide y se anota:** latencia de un trazo hasta el teléfono, fluidez del lienzo con el dedo, y tiempo de arranque del componente DOM.

---

## PdC 2 — PowerSync con la réplica central

**Antes de P2.1 se decide S7** (almacén de buckets: MongoDB o Postgres). Cambia cuántos contenedores lleva el compose de la PdC.

### P2.1 — Réplica central en Docker

Postgres con replicación lógica (versión 11 o posterior, como pide PowerSync), PowerSync Service (`journeyapps/powersync-service`) y su almacén de buckets.

**Verificación.** PowerSync responde en `/probes/liveness` y replica una tabla de prueba.

### P2.2 — Backend de escritura mínimo

Recibe la cola de subida, acepta solo el token de host de la sala y escribe en Postgres de forma síncrona. Responde con éxito y la causa ante un rechazo, sin `4xx`, como recomienda PowerSync. **No decide S3**: es un proceso desechable de la PdC.

### P2.3 — Host con el SDK de Node

Un proceso con `@powersync/node` que escribe un commit de prueba en su SQLite.

### P2.4 — Lector en el navegador

Una página con `@powersync/web` que lee los commits de una sala. El token de lectura es un **token de desarrollo** de PowerSync: S6 se decide con lo que enseñe la PdC.

### Criterios de la PdC 2

| # | Pasa si |
|---|---|
| 1 | El host escribe sin red y la cola sube al volver |
| 2 | Un cliente sin el token de host no puede escribir |
| 3 | El navegador ve el commit sin pasar por el relay |
| 4 | Apagar el host no le quita el historial a quien lo lee |
| 5 | Un rechazo del backend se revierte en el host y deja la causa visible |

**Se mide y se anota:** tiempo de un commit hasta que lo ve el lector, y memoria de los contenedores en reposo.

---

## Al terminar cada PdC

1. El resultado se anota en el análisis, con cada criterio y cada medición.
2. Se cierran o se reformulan las decisiones que dependían de ella, y se actualiza la v2.
3. Lo que no se adopte se borra.

## Qué no entra

- El enlace definitivo entre tldraw y Yjs (H2).
- Persistencia de la sala (H3).
- El esquema real de las tablas y el contrato de lo replicado (H4).
- Autenticación real del token de lectura (S6).
- Desplegar la réplica central en Makino Hara.
