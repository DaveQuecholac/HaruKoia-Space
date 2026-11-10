# Diseño de la app Expo

Rama: `dev/pizarra-colaborativa`.  
Análisis: [analisis-h2-pizarra-colaborativa.md](./analisis-h2-pizarra-colaborativa.md) (sección 4 y decisión E1).  
Plan: paso **C0**.

Este documento responde la puerta que la arquitectura deja abierta antes del lienzo. **No construye la app.** H2 monta el lienzo en `apps/web` (Vite). Crear `apps/app` y registrar PM2 es otra autorización, después de un *“C0 ok, seguimos”* y de un sí aparte para construir Expo.

Stack que ya está cerrado y este documento no reabre: Expo para web y móvil, tldraw dentro de un componente DOM, un teléfono no es host local. Referencia de motores y secretos: [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md). El repo Space no se modifica ni se copian sus paquetes.

## Respuestas a la sección 4 del análisis

| Pregunta | Respuesta |
|----------|-----------|
| Pantallas y flujo | Las mismas tres que H1: nombre, inicio, sala. Misma pantalla para host y espectador. El lienzo vive dentro de la sala. |
| Dónde vive tldraw | En un componente con la directiva `'use dom'` de Expo. En web es DOM real. En el teléfono lo pinta el WebView que Expo usa para esos componentes. No escribimos otro WebView. |
| Arranque PM2 y portless | El mismo kit del monorepo. Metro escucha el `PORT` que asigna el helper. No hay puerto fijo ni CLI `portless` envolviendo el proceso. |
| Qué se queda en Vite en H2 | Todo el lienzo de H2: dependencias, montaje, binding Yjs, cursores, offline del navegador y la medición. `apps/web` sigue siendo la app que se abre. |
| SQLite RN y secrets | No entran en H2. Cuando se construya la app, el patrón es el de Space: `expo-sqlite` en nativo, `sql.js` en la web de Expo, `expo-secure-store` en el teléfono, Web Crypto + IndexedDB en web. PowerSync en el cliente llega con la réplica, no con el lienzo. |
| Móvil | El teléfono entra como espectador por un link. No arranca un host local. La sala global es H7: hasta entonces el teléfono no tiene acción de “abrir sala”. |

## Pantallas

La gramática es la de H1, que ya cumple la interfaz de la v2: una sola interfaz, sin pantallas distintas por rol. La acción de host (invitar, cambiar el link) sigue siendo un bloque dentro de la sala, visible solo si el rol es host.

| Pantalla | Qué hace | Web (laptop) | Teléfono |
|----------|----------|--------------|----------|
| Nombre | Pide el nombre y lo recuerda. Identidad de la v1: link + nombre. | Igual | Igual |
| Inicio | “Volverme host” (pide la invitación al proceso host de esa máquina) y “Unirme” pegando el link. | Las dos acciones | Solo “Unirme” |
| Sala | Estado de la conexión, orquestador, participantes con nombre, salir. El host ve el link. Aquí se monta el lienzo. | Lienzo + presencia | Lienzo + presencia |

El link de invitación sigue siendo una URL HTTPS de la app (en desarrollo, el origen portless). No se inventa otro esquema de URL para el producto.

Estas piezas de la v2 **no son pantallas de este diseño** y no se dibujan en H2 ni al crear el esqueleto Expo: varias sesiones a la vez, modo en línea como interruptor propio, staging, historial, estado del push, estado de la réplica, controles de acceso. Cada una entra con su épica.

La gramática visual de IOKOIA Space (Tailwind, Base UI, NativeWind) no se trae. H2 no agrega un sistema de componentes: la sala de Vite sigue con los elementos que ya tiene, y el lienzo usa la interfaz de tldraw. Elegir un sistema visual para la app Expo es un paso de cuando se autorice construirla, no un hueco que bloquee el lienzo en Vite.

## Lienzo

Un solo componente DOM, dueño de la pizarra (M8), montado por la pantalla de sala.

- La directiva es `'use dom'` ([componentes DOM de Expo](https://docs.expo.dev/guides/dom-components/)).
- Ese archivo usa el DOM (`div`, tldraw). No usa vistas de React Native.
- El contenedor de la sala le da alto y ancho. tldraw llena ese contenedor con su propia API de tamaño. No se inventa un marco extra alrededor.
- El documento que edita es el `Y.Doc` de la sala que ya entrega `conexion-a-la-sala`. Un trazo no abre otro WebSocket.
- Cursores y selección ajenos van en el awareness de Yjs, encima del nombre que H1 ya publica. No reemplazan ese canal.

En H2 ese montaje ocurre en `apps/web/src/sala/`, en React DOM de Vite, sin la directiva `'use dom'`. La directiva aparece cuando el mismo lienzo se mude a la app Expo. Hasta entonces no existe `apps/app` y no hay un paquete compartido “de pizarra” nuevo: sacarlo es parte de construir Expo, no de C1–C6.

## Qué hace H2 en `apps/web`

| Paso | Dónde |
|------|--------|
| C1 montar tldraw vacío | Pantalla de sala en Vite |
| C2 un trazo cruza por el relay | Mismo `Y.Doc` de H1 |
| C3 convergencia | Clientes Yjs, sin UI nueva de Expo |
| C4 cursores | Awareness ya usado para el nombre |
| C5 sin red | Log del cliente en el navegador (IndexedDB). No es el disco del host |
| C6 latencia | Medición publicada en el README de la rama |

El orquestador no gana palabras de pizarra ni de tldraw.

## Arranque, cuando se autorice construirla

Misma cadena que el resto del monorepo ([estructura del proyecto](../../../fijos/estructura-del-proyecto.md)):

```text
PM2 → scripts/pm2-portless-run.mjs → apps/app/scripts/run-dev.mjs → expo start --port $PORT
```

`pm2-portless-run` busca el puerto, lo escribe en `~/.portless/routes.json` y lo pasa en `PORT`. El script de la app solo reenvía ese valor a Metro (`--port`). El `.env` de la app no define `PORT`. No se copia el puerto fijo que Space usa en `metro:plain`.

Un solo proceso PM2 sirve el target web (lo que abre la URL portless) y el bundle nativo (lo que abre el teléfono en desarrollo). No hay una app Vite y una app Metro a la vez para la misma superficie: mientras H2 no termine y no se autorice el reemplazo, la URL que se usa es la de `apps/web`.

Identidad, alineada a las otras apps. Se copia a `ecosystem.config.cjs`, `scripts/pm2-dev.mjs`, `scripts/pm2-root-dev.mjs` y `.cursor/rules/pm2-app.mdc` **solo** al construir:

| Campo | Valor |
|-------|--------|
| Paquete | `apps/app` |
| Nombre npm | `@harukoia/app` |
| `APP_NAME` | `harukoia-app-dev` |
| `PORTLESS_NAME` | `app.harukoia.local.iokoia` |
| URL | `https://app.harukoia.local.iokoia.dev/` |

SDK: Expo 57, el mismo que Space ya fijó. Las versiones concretas salen de `npx expo install` en ese momento, no de este documento. Dependencias nativas no se pinchan a mano. En Metro, los paquetes del workspace se pinnean y, si el entry `node` gana por error, se desactiva `unstable_enablePackageExports` (lección de Space).

`dev:plain` es `expo start` sin PM2 ni portless, igual que el resto de apps tienen su crudo.

El teléfono en desarrollo habla con ese Metro. No es un segundo proceso. Un dev client (`expo-dev-client`) hace falta cuando entren módulos nativos (`expo-sqlite`, `expo-secure-store`, más adelante `@powersync/react-native` y `op-sqlite`). El lienzo DOM solo no obliga a ese cliente.

## SQLite, secrets y réplica

No se cablean en H2. Cuando la app exista, se parte de Space sin importar `@iokoia/space-*`:

| Pieza | Nativo | Web de la misma app Expo |
|-------|--------|---------------------------|
| SQLite de device | `expo-sqlite` | `sql.js` |
| Secrets | `expo-secure-store` | Web Crypto AES-GCM + IndexedDB (`webcrypto-idb`) |
| Espejo de la réplica | `@powersync/react-native` + `op-sqlite` (rango que Space ya usa: `≥17.1 <19`) | `@powersync/web` |

El sync, el día que exista, vive en el shell de la app: una conexión por cliente, y salir de la sala no lo corta. Los tokens no se guardan en claro en SQLite. La escritura que alimenta la réplica sigue siendo solo la del host. El offline de H2 (C5) es el log Yjs del navegador en Vite, no esta tabla.

## Móvil

Un teléfono no ejecuta `apps/host` ni el interruptor de host local. En la pantalla de inicio del teléfono no está “Volverme host”. Entrar es pegar o abrir el link, como espectador. Los dos roles siguen dibujando: el rol no cambia en H2, y el teléfono dibuja porque es un cliente más de la sala, no porque sea host.

La sala global (host en servidor, sin laptop) es H7. Hasta esa épica el diseño no agrega un botón de sala global.

## Qué confirma este paso y qué no

Confirma E1: las respuestas de arriba. No confirma E2 (versión del binding tldraw, se anota en C1 contra la documentación oficial) ni E3 (fragmento Yjs del tablero, se cierra antes de C2).

**Hecho de C0** cuando este archivo existe y en el chat se dice *“C0 ok, seguimos”*. Hasta esa frase no hay ediciones de lienzo en `apps/**` ni `packages/**`.
