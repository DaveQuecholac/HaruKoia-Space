# Evidencia — H4 cierre (V9)

Rama: `dev/versiones-pizarra`.  
Fecha: **2026-11-18**.  
Plan: [plan-h4-versiones-pizarra.md](./plan-h4-versiones-pizarra.md) § V9.  
Análisis: [analisis-h4-versiones-pizarra.md](./analisis-h4-versiones-pizarra.md) §11.  
Réplica (puerta previa): [evidencia-replica-central.md](./evidencia-replica-central.md).

## Definition of done (fase 1 §7 / análisis §11)

| # | Criterio | Automatizado | Cómo se vio |
|---|----------|--------------|-------------|
| 1 | Guardar → historial → checkout → seguir dibujando | **Pasa** (host + entre-procesos) | `hacer-checkout` + `commitear`; suite host checkout; `pruebas-entre-procesos` checkout A→B→checkout A→C |
| 2 | Export/import JSON idéntico | **Pasa** | `packages/domain` traductor: export → import sin pérdida |
| 3 | JSON legible en diff | **Pasa** | Traductor: campos en español / propios; sin `typeName` de tldraw en el JSON |
| 4 | Padre correcto tras checkout | **Pasa** | Host + entre-procesos: commit C cuelga del commit chequeado |

## Suites y typecheck (2026-11-18)

| Paquete | Tests | Typecheck |
|---------|-------|-----------|
| `@harukoia/domain` | 76 passed | OK |
| `@harukoia/schema` | 29 passed | OK |
| `@harukoia/host` | 70 passed | OK |
| `@harukoia/web` | 24 passed | OK |
| `@harukoia/pruebas-entre-procesos` | 30 passed | OK |

Comandos:

```bash
pnpm --filter @harukoia/domain test
pnpm --filter @harukoia/schema test
pnpm --filter @harukoia/host test
pnpm --filter @harukoia/web test
pnpm --filter @harukoia/pruebas-entre-procesos test
pnpm --filter @harukoia/host typecheck
pnpm --filter @harukoia/web typecheck
pnpm --filter @harukoia/pruebas-entre-procesos typecheck
pnpm --filter @harukoia/domain typecheck
pnpm --filter @harukoia/schema typecheck
```

## Humo en la app (lo cierra el chat)

Hasta que el chat confirme este checklist, V9 no se declara cerrado del todo.

1. Host + web arriba; entra como host a la sala.
2. Dibuja → **Crear versión** / **Commitear** con un mensaje.
3. Abre **Historial**: aparece el commit.
4. Dibuja otra cosa → Commitear de nuevo.
5. En Historial, vuelve (checkout) a la primera versión: el lienzo vuelve.
6. Dibuja y Commitear otra vez: el nuevo commit cuelga de la versión chequeada (se ve en el historial / padre).

Opcional (V7, réplica): con host apagado, `pnpm --filter @harukoia/pruebas-entre-procesos humo:v7` (ver [evidencia-h4-v7.md](./evidencia-h4-v7.md)).

## Qué no entra / queda abierto

- H5 (push, markdown, CLI, git).
- Historial de réplica **dentro** del navegador con host apagado (mixed content HTTPS→HTTP).
- Borrador local del host (post-H4).
- Limpieza de `pruebas/replica-central/` (sigue de referencia; no producto).

## Promoción a fijos

En V9 se actualizó [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md) § H4 con el copy de staging/commit y el estado de implementación. D-H4-1 y decisiones de réplica ya estaban en fijos desde el arranque documental.
