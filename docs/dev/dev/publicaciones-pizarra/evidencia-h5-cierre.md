# Evidencia — H5 cierre (P11)

Rama: `dev/publicaciones-pizarra`.  
Fecha: **2026-11-25**.  
Plan: [plan-h5-publicaciones-pizarra.md](./plan-h5-publicaciones-pizarra.md) § P11.  
Análisis: [analisis-h5-publicaciones-pizarra.md](./analisis-h5-publicaciones-pizarra.md) §9.

## Definition of done (fase 1 §8 / análisis §9)

| # | Criterio | Automatizado | Cómo se vio |
|---|----------|--------------|-------------|
| 1 | Quien no estuvo corre comando → markdown + tablero | **Pasa** | E2E `e2e-h5-git.test.ts`: publicar → `reset` atrás → `correrUpdate` recupera `documento.md` + `tablero.json` |
| 2 | Comando ×2 no cambia nada | **Pasa** | Mismo E2E + suite CLI P10: segunda corrida `yaAlDia`, huella idéntica |
| 3 | Remoto adelantado con reintento | **Pasa** | E2E segundo caso + `publicar-en-git.test.ts` (P7) |
| 4 | Fallo visible + reintento sin redibujar | **Pasa** | `publicar.test.ts` (P8): `HARUKOIA_PUBLICAR_FALLA` / reintento mismo `commitId`, historial intacto |

## Suites y typecheck (2026-11-25)

| Paquete / filtro | Resultado |
|------------------|-----------|
| `@harukoia/cli` test | 11 passed |
| `@harukoia/host` `src/publicacion` + `publicar` | 43 passed |
| `@harukoia/pruebas-entre-procesos` `e2e-h5-git` | 2 passed |
| Typecheck `cli` / `host` / `pruebas-entre-procesos` | OK |

Comandos:

```bash
pnpm --filter @harukoia/cli test
pnpm --filter @harukoia/host test -- src/publicacion src/acciones-de-sala/publicar
pnpm --filter @harukoia/pruebas-entre-procesos test -- src/publicacion/e2e-h5-git.test.ts
pnpm --filter @harukoia/cli typecheck
pnpm --filter @harukoia/host typecheck
pnpm --filter @harukoia/pruebas-entre-procesos typecheck
```

## Humo en la app (checklist para el chat)

Pendiente de aprobación explícita del chat. Pasos:

1. Host + web arriba (`pnpm dev:start` en raíz o por app).
2. Entra como host → dibuja → **Crear versión / Commitear**.
3. En **Historial** → **Publicar al repo** → ver **en proceso** → **publicado** (o fallido + causa).
4. Si falló (p. ej. `HARUKOIA_PUBLICAR_FALLA=…` en el host): **Reintentar publicación** sin redibujar.
5. En `apps/host` (checkout ligado):
   ```bash
   node ../cli/bin/space.js status
   node ../cli/bin/space.js update
   node ../cli/bin/space.js update
   ```
   La segunda debe decir «Ya al día…» y no tocar `harukoia/publicado/…`.
6. En otro clon del mismo remoto: `space update` (o el binario local) → aparecen `documento.md` + `tablero.json`.

## Qué no entra / queda abierto

- H6 (IA, PDF, Word).
- Instalación global de `space` en PATH.
- Sala global / host en servidor (H7).
- Unirse a sala desde el CLI.

## Promoción a fijos

Nota de cierre en [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md) § H5.
