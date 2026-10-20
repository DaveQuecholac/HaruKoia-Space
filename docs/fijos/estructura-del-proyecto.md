# Estructura del proyecto

Estructura base del monorepo, derivada del [análisis de arquitectura v2](./arquitectura/analisis-arquitectura-v2.md). Lo que hay hoy son los esqueletos de los procesos y el arranque; la funcionalidad entra por rebanadas, con su documentación de rama.

## Árbol

```text
motor-colaborativo/
├── apps/
│   ├── orchestrator/       orquestador: registro de salas, links, relay
│   ├── host/               contenedor host: sala Yjs, SQLite de PowerSync, repo, IA, exportación
│   ├── web/                pizarra, presencia, lectura local de lo replicado
│   └── cli/                binario `space`
├── packages/
│   ├── schema/             esquemas de las tablas replicadas
│   ├── domain/             sala, commit, push, estados, nombres de archivo
│   ├── registro/           una línea de log por evento, igual en los tres procesos
│   ├── cliente-del-relay/  entrada del invitado por el túnel, en navegador y Node
│   └── pruebas-entre-procesos/  pruebas que levantan orquestador y host a la vez
├── scripts/                kit PM2 + portless y orquestador de la raíz
├── docker/                 compose de orquestador y host (la réplica central entra con la PdC 2)
├── docs/
│   ├── fijos/              documentación permanente
│   └── dev/<rama-git>/     documentación de la rama en curso
└── .cursor/rules/          reglas de agente
```

## Por qué estos paquetes

| Paquete | Responsabilidad | Escala y falla |
|---------|-----------------|----------------|
| `apps/orchestrator` | Registro de salas y relay por identificador. No persiste el tablero | Por conexiones. Si se reinicia, hosts e invitados reconectan |
| `apps/host` | Autoridad de la sala y dueño del commit. Único que escribe en la réplica central. Base local, repositorio, IA, exportación | Por sala. Su caída cierra esa sala, no las demás |
| `apps/web` | Interfaz y lectura local de lo replicado. Puede cambiar a Expo según la PdC 1 | En el cliente |
| `apps/cli` | Arrancar el host, estado, materializar markdown | En la máquina del developer |
| `packages/schema` | Contrato de datos entre web, host y CLI | — |
| `packages/domain` | Reglas del dominio sin transporte ni almacenamiento | — |
| `packages/registro` | Formato de log común. Un fallo se sigue entre los tres procesos filtrando por sala | — |
| `packages/cliente-del-relay` | Lado invitado del túnel: presenta el token, espera la aceptación y entrega un socket normal al proveedor de la sala. Lo usan la web y las pruebas. Es transporte, por eso no vive en `domain` | — |
| `packages/pruebas-entre-procesos` | Pruebas sin un único dueño: las que levantan más de un proceso. Las unitarias viven junto al código que prueban | — |

El criterio para crear un proceso nuevo está en [por-que-no-microservicios.md](./arquitectura/por-que-no-microservicios.md). Una capacidad nueva es un módulo dentro de uno de estos paquetes hasta que cumpla alguna de las cuatro condiciones de ahí.

**Réplica central** (revisión 2026-10-19). La arquitectura agrega Postgres, PowerSync Service y un backend de escritura en la nube ([v2, sección 4](./arquitectura/analisis-arquitectura-v2.md#4-topología)). Todavía no tienen paquete ni contenedor: si el backend vive dentro de `apps/orchestrator` o en una app propia es un punto abierto, y se decide con la prueba de concepto de PowerSync. Cuando entre una app nueva, se registra como dice `.cursor/rules/pm2-app.mdc`.

## Arranque con PM2 y portless

Se adopta el patrón `pm2_portless` de IOKOIA, el mismo del sistema de gestión de contratos. El kit de `scripts/` es copia del bundle del CLI (`@iokoia/devcli` → `templates/pm2_portless/`).

### Gesto

```bash
pnpm install          # una vez, en la raíz
pnpm dev              # arranca las tres apps y deja los logs en seguimiento
pnpm dev:stop         # apaga todas
```

`pnpm dev` hace, en orden: `pnpm install` de la app, arranque o reinicio en PM2, registro del hostname en el proxy, y seguimiento de logs. **Ctrl+C solo corta el seguimiento**; para apagar es `dev:stop`.

Dentro de una app, los mismos comandos aplican solo a ella.

| Comando | Alcance |
|---------|---------|
| `pnpm dev` | Arranca y sigue logs |
| `pnpm dev:start` / `dev:stop` / `dev:restart` | Control sin seguimiento |
| `pnpm dev:status` | Estado en PM2 y URL pública |
| `pnpm dev:logs` | Solo seguimiento |
| `pnpm dev:plain` | Crudo, sin PM2 ni portless |

### Cómo funciona

```text
PM2 → node → scripts/pm2-portless-run.mjs → apps/<app>/scripts/run-dev.mjs → proceso
                    │
                    └─ busca un puerto libre, lo registra en ~/.portless/routes.json
                       y lo pasa al proceso en PORT
```

Qué lleva cada `.env` y qué orquestador usar: [configuracion-del-entorno.md](./configuracion-del-entorno.md).

El proceso **no elige puerto**: lo recibe en `PORT`. Por eso los `.env` de las apps no definen `PORT`. El proxy portless atiende el hostname público y enruta al puerto registrado.

No se envuelve la app con el CLI `portless` bajo PM2: en Windows abre consolas visibles y cerrarlas mata el proceso. El camino es `pm2-portless-run.mjs`.

### URLs de desarrollo

Desde el 2026-10-02 las máquinas IOKOIA usan el sufijo `.local.iokoia` con el TLD del proxy en `dev`.

| App | Proceso PM2 | URL |
|-----|-------------|-----|
| `apps/orchestrator` | `harukoia-orchestrator-dev` | `https://orquestador.harukoia.local.iokoia.dev/` |
| `apps/host` | `harukoia-host-dev` | `https://host.harukoia.local.iokoia.dev/` |
| `apps/web` | `harukoia-web-dev` | `https://web.harukoia.local.iokoia.dev/` |

Identidad completa y qué actualizar al agregar una app: `.cursor/rules/pm2-app.mdc`. Operación y prohibiciones del agente: `.cursor/rules/pm2-dev.mdc`.

### Requisitos de la máquina

| Requisito | Cómo se cumple |
|-----------|----------------|
| Proxy portless como servicio | `iokoia install portless` |
| `~/.portless` escribible por el usuario de PM2 | Si el proxy se levantó como root en el 443, corregir propiedad |
| Node ≥ 23.6 | El orquestador y el host ejecutan TypeScript directo en desarrollo |
| Un solo PM2 | Está fijado en la raíz; tras instalar, `pnpm exec pm2 update` una vez |

Si el proxy no está arriba, el helper se detiene con el mensaje y el comando para instalarlo. No se rodea arrancando el proceso en un puerto fijo.

## Contenedores

El compose de `docker/` levanta hoy dos contenedores: orquestador y host. El host incluye `git` y `pandoc`, porque comitea y exporta. Su volumen `/data` guarda la base local y la copia de trabajo.

La réplica central (Postgres, PowerSync Service y el backend de escritura) todavía no está en el compose: entra con la prueba de concepto de PowerSync. PowerSync publica su imagen como `journeyapps/powersync-service` y tiene guía para desplegarse en Coolify.

```bash
pnpm docker:up
pnpm docker:down
```

El día a día es PM2 y portless. El compose sirve para probar la separación real y para la sala global.

## Estado actual

H0 y H1 están hechas en la rama `dev/motor`: arranque, registro de salas, relay por túnel inverso, sala Yjs en vivo con presencia, roles mínimos y las pantallas de entrada. Detalle y lo que falta para cerrar H1 en [docs/dev/dev/motor/README.md](../dev/dev/motor/README.md).

Todavía no hay lienzo, ni persistencia de la sala, ni commit, ni réplica. Eso entra por las rebanadas de la [fase 1](./fases/fase-1-modulos-y-tareas.md), cada una con su análisis y su plan en `docs/dev/<rama>/`. Lo siguiente son las dos pruebas de concepto de la revisión del 2026-10-19.
