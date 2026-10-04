# Motor colaborativo — HaruKoia

Pizarra colaborativa para equipos de desarrollo. Lo que se trabaja en la junta se versiona, se convierte en markdown y llega al repositorio de quienes no estuvieron, sin que tengan que abrir la aplicación.

Motor nuevo desde cero. Los módulos de IOKOIA Space se migrarán aquí después, uno a uno.

## Arrancar

```bash
pnpm install
pnpm dev        # arranca orquestador, host y web, y sigue los logs
pnpm dev:stop   # apaga todo
```

Ctrl+C solo corta el seguimiento de logs; para apagar es `dev:stop`.

| App | URL de desarrollo |
|-----|-------------------|
| Orquestador | `https://orquestador.harukoia.local.iokoia.dev/` |
| Host | `https://host.harukoia.local.iokoia.dev/` |
| Web | `https://web.harukoia.local.iokoia.dev/` |

Requiere el proxy portless instalado en la máquina (`iokoia install portless`) y Node ≥ 23.6.

## Dónde está qué

| Ruta | Qué hay |
|------|---------|
| `apps/orchestrator` | Registro de salas, links y relay |
| `apps/host` | Sala en vivo, base local, repositorio, markdown y exportación |
| `apps/web` | Pizarra, presencia y lectura de lo publicado |
| `apps/cli` | Binario `space` |
| `packages/schema`, `packages/domain` | Contrato de datos y dominio |
| `docker/` | Los dos contenedores |

## Documentación

| Documento | Para qué |
|-----------|----------|
| [Arquitectura v2](./docs/fijos/arquitectura/analisis-arquitectura-v2.md) | La decisión vigente: componentes, datos, errores y pruebas |
| [Estructura del proyecto](./docs/fijos/estructura-del-proyecto.md) | Paquetes, procesos y arranque |
| [Fase 1 — módulos y tareas](./docs/fijos/fases/fase-1-modulos-y-tareas.md) | Qué se construye, en qué orden y quién |
| [Índice de documentación](./docs/README.md) | Cómo está organizada |
