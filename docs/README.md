# Documentación — Motor colaborativo HaruKoia

La documentación se divide en dos, y no se mezclan.

| Carpeta | Qué es | Vida |
|---------|--------|------|
| [`fijos/`](./fijos/) | Documentación **fija** del producto: contexto, arquitectura, fases, estructura | Permanente. Se actualiza, no se archiva |
| [`dev/`](./dev/) | Documentación **de desarrollo**, una carpeta **por rama de git** | Vive con su rama: análisis, plan, notas, evidencia |

## Documentación fija

| Documento | Qué manda |
|-----------|-----------|
| [`fijos/inicial/contexto-inicial.md`](./fijos/inicial/contexto-inicial.md) | Contexto y alcance del producto |
| [`fijos/inicial/acuerdos-junta-fase2.md`](./fijos/inicial/acuerdos-junta-fase2.md) | Acuerdos de la junta que originaron la arquitectura v2 |
| [`fijos/arquitectura/analisis-arquitectura-v2.md`](./fijos/arquitectura/analisis-arquitectura-v2.md) | **Arquitectura vigente**: decisión, componentes, datos, errores, pruebas |
| [`fijos/arquitectura/arquitectura-recomendada.md`](./fijos/arquitectura/arquitectura-recomendada.md) | Arquitectura previa; vigente solo en lo que la v2 no cambió |
| [`fijos/arquitectura/por-que-no-microservicios.md`](./fijos/arquitectura/por-que-no-microservicios.md) | Criterio para convertir una capacidad en proceso propio |
| [`fijos/estructura-del-proyecto.md`](./fijos/estructura-del-proyecto.md) | Paquetes, procesos, arranque con PM2 y portless |
| [`fijos/configuracion-del-entorno.md`](./fijos/configuracion-del-entorno.md) | Cada `.env`, qué orquestador usar, y cómo actualizar una instalación anterior |
| [`fijos/fases/fase-1-modulos-y-tareas.md`](./fijos/fases/fase-1-modulos-y-tareas.md) | Módulos de la fase 1, dependencias y reparto de tareas |

## Documentación de desarrollo

Una carpeta por rama de git, con los mismos segmentos que la rama:

```text
rama  dev/pizarra-sesion
  →   docs/dev/dev/pizarra-sesion/
```

Qué lleva cada carpeta y por qué es obligatoria antes de codear: [`dev/README.md`](./dev/README.md) y la regla `.cursor/rules/docs-layout.mdc`.
