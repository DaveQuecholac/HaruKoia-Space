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
| `apps/web` | `VITE_TLDRAW_LICENSE_KEY` | Vacía en desarrollo | Licencia de tldraw. El build público la hornea. Sin ella el lienzo se apaga a los cinco segundos |
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

Al reiniciar el host vuelve la misma sala: el documento está en su SQLite y la identidad en el keyring. El link que ya se compartió sigue abriendo esa sala. El registro del orquestador sigue en memoria; si el orquestador se reinicia, el host se vuelve a registrar.

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

## Probar H2 con alguien que no tiene el repositorio

La web pública es `https://web.harukoia.makinohara.sys.iokoia.com`. Ahí está horneado el orquestador compartido, `VITE_HOST_URL=https://host.harukoia.local.iokoia.dev` y `VITE_TLDRAW_LICENSE_KEY`. La key no va en el repositorio: es un argumento de construcción de esa imagen. El dominio autorizado tiene que cubrir ese host.

En la laptop del host, `apps/host/.env` queda así y se aplica con `pm2 delete` y `dev:start`:

```bash
ORQUESTADOR_URL=wss://orquestador.harukoia.makinohara.sys.iokoia.com
WEB_ORIGEN=https://web.harukoia.makinohara.sys.iokoia.com
```

"Volverme host" se pulsa en **esa** web, en el navegador de la laptop: la invitación solo sale si el origen coincide y la petición llega por loopback. El teléfono abre el link que salga de ahí. No llama al host y no necesita el repositorio.

La web local (`web.harukoia.local.iokoia.dev`) deja de poder pedir la invitación mientras `WEB_ORIGEN` apunte a la web pública. Para volver al día a día local, `WEB_ORIGEN` regresa a `https://web.harukoia.local.iokoia.dev`.

## Síntomas y causa

| Ves | Causa | Arreglo |
|---|---|---|
| "La sala no está abierta en este orquestador…" y el host sí está corriendo | Host e invitado en orquestadores distintos | Mismo orquestador en los dos `.env`, luego `pm2 delete` y `dev:start` |
| Cambiaste el `.env` y nada cambió | PM2 conserva el entorno viejo | `pm2 delete` y `dev:start`, no `dev:restart` |
| Un link que funcionaba ya no funciona | El host se reinició y la sala es otra | "Volverme host" de nuevo y mandar el link nuevo |
| "No hay un host corriendo en esta máquina" | El host no está arriba | `pnpm dev:start` en `apps/host` |
| "El host de esta máquina no le dio la invitación a esta web" | Falta o no coincide `WEB_ORIGEN` en `apps/host/.env` | Copiar el valor del `.env.example` |
| "Falta VITE_ORQUESTADOR_URL en apps/web/.env" | No hay `.env` en la web | Copiar el `.env.example` |
