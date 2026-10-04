# Documentación de desarrollo (por rama)

Aquí vive el trabajo **en curso**. Una carpeta por rama de git, con los **mismos segmentos** que la rama.

```text
rama  dev/pizarra-sesion        →  docs/dev/dev/pizarra-sesion/
rama  dev/cli-space-update      →  docs/dev/dev/cli-space-update/
rama  fix/relay-reconexion      →  docs/dev/fix/relay-reconexion/
```

La ruta se obtiene de `git branch --show-current`. No se inventa un nombre "temático" distinto al de la rama.

## Qué lleva cada carpeta

| Archivo | Para qué |
|---------|----------|
| `README.md` | Índice de la rama: para qué es, rebanadas, estado, decisiones tomadas |
| `analisis-*.md` | Contexto, opciones, decisiones y restricciones — **antes** del código |
| `plan-*.md` | Rebanadas ordenadas, archivos, criterios de aceptación — **antes** del código |
| `evidencia-*.md` | Qué se probó y con qué resultado (opcional, por rebanada) |

## Puerta antes de codear

**Sin `analisis-*.md` y `plan-*.md` que cubran la rebanada, no se escribe código de producto.** Una propuesta en el chat no sustituye estos archivos. La regla que lo exige es `.cursor/rules/docs-layout.mdc`.

Si el código ya existe sin documentación: detener las ediciones, escribir el análisis y el plan de forma retroactiva, y continuar alineado a ellos.

## Qué no va aquí

- Decisiones permanentes de arquitectura, contexto de producto o fases → `docs/fijos/`.
- Si una nota de rama se vuelve una decisión permanente, se **promueve** a `docs/fijos/` y la carpeta de rama la enlaza.

## Al cerrar la rama

La carpeta se queda como registro. Lo que haya cambiado de forma permanente ya debe estar reflejado en `docs/fijos/`.
