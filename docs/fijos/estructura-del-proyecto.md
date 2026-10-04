# Estructura del proyecto

Estructura base del monorepo, derivada del [análisis de arquitectura v2](./arquitectura/analisis-arquitectura-v2.md). Lo que hay hoy son los esqueletos de los procesos y el arranque; la funcionalidad entra por rebanadas, con su documentación de rama.

## Árbol

```text
motor-colaborativo/
├── apps/
│   ├── orchestrator/       orquestador: registro de salas, links, relay
│   ├── host/               contenedor host: sala Yjs, base local, repo, IA, exportación
│   ├── web/                pizarra, presencia, lectura local
│   └── cli/                binario `space`
├── packages/
│   ├── schema/             esquemas de las colecciones replicadas
│   └── domain/             sala, commit, push, estados, nombres de archivo
├── scripts/                kit PM2 + portless y orquestador de la raíz
├── docker/                 compose de los dos contenedores
├── docs/
│   ├── fijos/              documentación permanente
│   └── dev/<rama-git>/     documentación de la rama en curso
└── .cursor/rules/          reglas de agente
```

## Por qué estos paquetes

| Paquete | Responsabilidad | Escala y falla |
|---------|-----------------|----------------|
| `apps/orchestrator` | Registro de salas y relay por identificador. No persiste el tablero | Por conexiones. Si se reinicia, hosts e invitados reconectan |
| `apps/host` | Autoridad de la sala y dueño del commit. Base local, repositorio, IA, exportación | Por sala. Su caída cierra esa sala, no las demás |
| `apps/web` | Interfaz y base local del navegador | En el cliente |
| `apps/cli` | Arrancar el host, estado, materializar markdown | En la máquina del developer |
| `packages/schema` | Contrato de datos entre web, host y CLI | — |
| `packages/domain` | Reglas del dominio sin transporte ni almacenamiento | — |

El criterio para crear un proceso nuevo está en [por-que-no-microservicios.md](./arquitectura/por-que-no-microservicios.md). Una capacidad nueva es un módulo dentro de uno de estos paquetes hasta que cumpla alguna de las cuatro condiciones de ahí.

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

El compose de `docker/` levanta los dos contenedores que fija la arquitectura: orquestador y host. El host incluye `git` y `pandoc`, porque comitea y exporta. Su volumen `/data` guarda la base local y la copia de trabajo.

```bash
pnpm docker:up
pnpm docker:down
```

El día a día es PM2 y portless. El compose sirve para probar la separación real y para la sala global.

## Estado actual

Los esqueletos responden `/health` y nada más. No hay sala, ni commit, ni réplica. Eso entra por las rebanadas de la [fase 1](./fases/fase-1-modulos-y-tareas.md), cada una con su análisis y su plan en `docs/dev/<rama>/`.

Pendiente de la máquina, no del repo: inicializar git. Sin rama no hay carpeta de documentación de desarrollo.
