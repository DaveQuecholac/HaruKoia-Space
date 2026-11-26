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

**Aprobado por el chat (2026-11-25).** P11 / H5 cerrados.

Checklist que se cerró:

1. Host + web: Commitear → **Publicar al repo** → estado publicado (y reintento si falló).
2. `space update` (binario local desde el checkout) ×2 → segunda «Ya al día»; generados intactos.
3. Suites E2E + DoD §1–4 en verde (tabla arriba).

## Qué no entra / queda abierto

- H6 (IA, PDF, Word).
- Instalación global de `space` en PATH.
- Sala global / host en servidor (H7).
- Unirse a sala desde el CLI.

## Promoción a fijos

Nota de cierre en [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md) § H5.
