# Evidencia — H4 V7 (historial con host apagado)

Rama: `dev/versiones-pizarra`.  
Fecha: **2026-11-18**.  
Plan: [plan-h4-versiones-pizarra.md](./plan-h4-versiones-pizarra.md) § V7.  
Análisis: [analisis-h4-versiones-pizarra.md](./analisis-h4-versiones-pizarra.md) §8 / H4-T9.  
Referencia PdC: [evidencia-replica-central.md](./evidencia-replica-central.md) criterio 4.

## Qué se demostró

Con el **host detenido** (`harukoia-host-dev` stopped; `/invitacion` → 404), un lector Node abre PowerSync con JWT de lectura (`GET /sync/bootstrap` del `apps/backend-escritura`), **sin** `ORQUESTADOR_URL` ni relay, y lista los commits de la sala en Postgres vía sync.

| Comprobación | Resultado |
|--------------|-----------|
| Host apagado | Sí (PM2 stopped; invitacion 404) |
| Lectura solo PowerSync | Sí (`humo:v7`) |
| Commits de producto visibles | 4 filas (las del humo de la app + V6) |
| Snapshot del tip presente | Sí (`tablero_json` con formato 1) |
| F-R6 (JWT de otra sala) | No ve el commit |

Comando repetible:

```bash
pnpm --filter @harukoia/host dev:stop   # si el host está arriba
pnpm --filter @harukoia/pruebas-entre-procesos humo:v7
```

Usa `SALA_DEL_HOST` de `apps/backend-escritura/.env` (o `SALA_LECTURA`) y la estación `pruebas/replica-central/` + backend en `:18091`.

## Qué no entra en V7

- Cablear `@powersync/web` en la app Vite: la web es HTTPS (`*.local.iokoia.dev`) y PowerSync/backend locales son HTTP → mixed content. Hace falta portless HTTPS (o BFF) antes de mostrar el historial de réplica **dentro** del navegador con el host apagado.
- Mientras el host está arriba, el panel Historial de la sala sigue llegando por la sesión (V4); V7 prueba el camino de réplica independiente.

## Prueba unitaria de ruta

`packages/pruebas-entre-procesos/.../sin-orquestador.test.ts` — el fuente del lector no menciona orquestador ni `/relay/`.
