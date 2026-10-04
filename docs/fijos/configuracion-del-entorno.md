# Configuración del entorno (`.env`)

Cómo se arma el `.env` de cada app para que las salas funcionen **entre máquinas**. Si ya tenías el proyecto corriendo antes del 2026-10-04, ve directo a [Si ya lo tenías corriendo](#si-ya-lo-tenías-corriendo).

## La regla

**El host de la sala y la web de cada participante tienen que usar el mismo orquestador.**

El orquestador es quien sabe qué salas están abiertas. Si el host se registra en uno y el invitado entra por otro, el invitado no la encuentra y la web dice:

> La sala no está abierta en este orquestador: su host no está conectado, o está registrado en otro orquestador.

La pantalla de la sala muestra abajo del estado a qué orquestador está conectada. Si dos personas ven valores distintos, ese es el problema.

## Qué orquestador usar

| Orquestador | URL | Cuándo |
|---|---|---|
| **Compartido** (Makino Hara) | `wss://orquestador.harukoia.makinohara.sys.iokoia.com` | **Por defecto.** Personas en máquinas o redes distintas |
| Local | `wss://orquestador.harukoia.local.iokoia.dev` | Solo si el host y **todos** los participantes están en la misma máquina |

**La URL local no es compartida.** `orquestador.harukoia.local.iokoia.dev` la resuelve el proxy portless **de cada máquina**: en tu laptop es tu orquestador, en la de otra persona es el suyo. Dos laptops con la URL local nunca se ven, aunque la URL sea idéntica.

`host.harukoia.local.iokoia.dev` y `web.harukoia.local.iokoia.dev` sí deben ser locales: cada quien corre su propia web, y el host es el de tu máquina.

## Variables por app

Cada app tiene su `.env.example` con los valores por defecto ya puestos. Instalación nueva: copiarlo y no tocar nada.

```bash
cp apps/host/.env.example apps/host/.env
cp apps/web/.env.example  apps/web/.env
cp apps/orchestrator/.env.example apps/orchestrator/.env
```

| App | Variable | Valor por defecto | Para qué |
|---|---|---|---|
| `apps/host` | `ORQUESTADOR_URL` | Compartido | Dónde registra su sala. Obligatoria: sin ella el host no arranca |
| `apps/host` | `WEB_ORIGEN` | `https://web.harukoia.local.iokoia.dev` | Habilita "Volverme host" para la web de esta máquina |
| `apps/web` | `VITE_ORQUESTADOR_URL` | Compartido | Por dónde entra a las salas. **Igual que `ORQUESTADOR_URL` del host** |
| `apps/web` | `VITE_HOST_URL` | `https://host.harukoia.local.iokoia.dev` | A qué host le pide la invitación "Volverme host" |
| `apps/orchestrator` | — | — | No necesita variables en desarrollo |

Ningún `.env` define `PORT`: lo asigna portless.

## Aplicar un cambio de `.env`

PM2 guarda el entorno del primer arranque: **`pnpm dev:restart` no relee el `.env`**. Hay que borrar el proceso y arrancarlo, dentro de la app:

```bash
# en apps/host
pnpm exec pm2 delete harukoia-host-dev && pnpm dev:start
# en apps/web
pnpm exec pm2 delete harukoia-web-dev && pnpm dev:start
```

Al reiniciar el host se crea una **sala nueva**: los links anteriores dejan de servir y hay que volver a pulsar "Volverme host". La sala vive en memoria hasta H3.

## Si ya lo tenías corriendo

Antes del 2026-10-04 los `.env.example` traían la URL **local** del orquestador. Quien copió esos ejemplos tiene un `.env` que solo funciona dentro de su propia máquina. Síntoma: crear salas funciona, pero nadie más puede entrar ("sala no abierta" o "sala cerrada").

Para actualizar:

1. `git pull`.
2. Vuelve a copiar los ejemplos. Si tenías algo propio en tu `.env`, pásalo a mano después:
   ```bash
   cp apps/host/.env.example apps/host/.env
   cp apps/web/.env.example  apps/web/.env
   ```
3. Revisa que quedaron así:
   ```bash
   grep -h '^[A-Z]' apps/host/.env apps/web/.env
   # ORQUESTADOR_URL=wss://orquestador.harukoia.makinohara.sys.iokoia.com
   # WEB_ORIGEN=https://web.harukoia.local.iokoia.dev
   # VITE_ORQUESTADOR_URL=wss://orquestador.harukoia.makinohara.sys.iokoia.com
   # VITE_HOST_URL=https://host.harukoia.local.iokoia.dev
   ```
   Si todavía tienes `VITE_ORQUESTADOR_ECO_URL`, sobra: era del diagnóstico de A3 y ya no existe.
4. Aplica el cambio con `pm2 delete` y `dev:start`, como en [Aplicar un cambio de `.env`](#aplicar-un-cambio-de-env).
5. Abre la web, entra a una sala y confirma que abajo del estado dice **Orquestador: orquestador.harukoia.makinohara.sys.iokoia.com**.

## Síntomas y causa

| Ves | Causa | Arreglo |
|---|---|---|
| "La sala no está abierta en este orquestador…" y el host sí está corriendo | Host e invitado en orquestadores distintos | Mismo orquestador en los dos `.env`, luego `pm2 delete` y `dev:start` |
| Cambiaste el `.env` y nada cambió | PM2 conserva el entorno viejo | `pm2 delete` y `dev:start`, no `dev:restart` |
| Un link que funcionaba ya no funciona | El host se reinició y la sala es otra | "Volverme host" de nuevo y mandar el link nuevo |
| "No hay un host corriendo en esta máquina" | El host no está arriba | `pnpm dev:start` en `apps/host` |
| "El host de esta máquina no le dio la invitación a esta web" | Falta o no coincide `WEB_ORIGEN` en `apps/host/.env` | Copiar el valor del `.env.example` |
| "Falta VITE_ORQUESTADOR_URL en apps/web/.env" | No hay `.env` en la web | Copiar el `.env.example` |
