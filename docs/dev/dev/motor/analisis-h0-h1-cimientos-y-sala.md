# Análisis — H0 Cimientos y H1 Sala por link

Rama: `dev/motor`. Cubre las épicas **H0** y **H1** de [fase 1](../../../fijos/fases/fase-1-modulos-y-tareas.md).

Este documento fija el contexto, las decisiones y los riesgos. El orden de ejecución está en [plan-h0-h1-cimientos-y-sala.md](./plan-h0-h1-cimientos-y-sala.md).

---

## 1. Qué se construye y por qué primero

H1 es la historia: **me vuelvo host, comparto un link, y alguien en otra red entra y nos vemos los dos en la lista de participantes.**

Se eligió como primera épica con funcionalidad porque concentra el riesgo técnico del proyecto. La arquitectura es host-autoritativa con relay: el contenedor host abre una conexión **saliente** al orquestador y los invitados nunca hablan directo con la máquina del host. Esa es la pieza que hace viable trabajar detrás de NAT sin abrir puertos, y es la única que no podemos copiar de una librería. Si no funciona, no importa qué tan buena sea la pizarra.

Dibujar juntos (H2) es, en comparación, predecible: el documento compartido y la fusión de cambios los resuelven las librerías que ya elegimos.

## 2. Qué fija el diseño vigente

Del [análisis de arquitectura v2](../../../fijos/arquitectura/analisis-arquitectura-v2.md), ya decidido y no se reabre:

| Punto | Decisión |
|-------|----------|
| Autoridad | El contenedor host es dueño de los datos. El navegador del host es un cliente más de su propia sala |
| Orquestador | Sirve la web, registra salas, genera links y enruta por identificador de sala. **No guarda el tablero** |
| Alcance de red | El host abre la conexión hacia el orquestador. Nunca se espera una conexión entrante al host |
| Reinicio del orquestador | No guarda nada: hosts e invitados reconectan y la sala se vuelve a registrar |
| Sala en vivo | Documento Yjs servido por Hocuspocus dentro del contenedor host |
| Identidad v1 | Link de invitación y nombre. Roles host y espectador. Autenticación después |
| Duplicados | El registro es por identificador único; el segundo host recibe un error claro |

## 3. Qué **no** dice el diseño y hay que decidir

El v2 define la topología, no el protocolo. Lo siguiente cambia el código y **ninguna de estas decisiones la toma el agente**: se confirman antes del paso que las necesita.

| Decisión | Estado | Bloquea |
|----------|--------|---------|
| D1 Librería del servidor | **Confirmada:** `node:http` + `ws` | B2 |
| D2 Cuándo entra la sala Yjs | **Confirmada:** sala real desde H1, con su presencia | B5 |
| D3 Forma del relay | **Confirmada:** túnel inverso | B1, B3, B4 |
| D4 Token del link separado | **Confirmada:** token de invitación aparte del identificador de sala | B2 |
| D5 Reconexión del host | **Confirmada:** el token de host correcto reemplaza el registro anterior | B2 |
| D6 Salas por proceso host | Pendiente — una en la v1 | B1 |
| D7 Dónde se sirve la web | **Confirmada:** link `https://<web>/s/<sala>#<token>` | B6 |
| D8 Runner de pruebas | **Confirmada:** Vitest | A4 |
| D9 Nombre del participante | **Confirmada:** en el navegador y en la presencia | B6 |

### D1 — Librería del servidor HTTP y WebSocket

| Opción | A favor | En contra |
|--------|---------|-----------|
| **a** `node:http` + `ws` | Sin capas; el orquestador solo enruta y no necesita router. Es lo que usa Hocuspocus por debajo | Hay que escribir a mano lo poco de HTTP que haga falta |
| **b** Fastify + su plugin de WebSocket | Router, validación y ciclo de vida ya hechos | Una capa más para un proceso que casi no tiene rutas |
| **c** uWebSockets.js | El más rápido | Binario nativo, menos común en el equipo |

**Decisión: (a) `node:http` + `ws`.** El orquestador de la v1 tiene tres rutas y un túnel. Cuando crezca se puede migrar sin tocar el protocolo, porque el protocolo no depende de la librería.
**Bloquea:** paso B2.

### D2 — Cuándo entra la sala Yjs

La presencia de H1 puede construirse de dos formas.

| Opción | Consecuencia |
|--------|--------------|
| **a** Montar la sala Yjs real desde H1 y usar su mecanismo de presencia | H1 ya levanta el servidor de sala sin lienzo. H2 solo agrega el lienzo encima |
| **b** Canal propio de presencia en H1, sala Yjs hasta H2 | Se construye un mecanismo que se tira en H2 |

**Decisión: (a)**, confirmada el 2026-10-04. Es la diferencia entre H2 ser "conectar el lienzo" o ser "conectar el lienzo y además desmontar lo de presencia".
**Bloquea:** paso B5.

Decisiones que salieron al aterrizarla en B5:

- El lado invitado del túnel vive en un **paquete nuevo**, `packages/cliente-del-relay`: lo necesitan las pruebas de B5 y la web de B6, y es transporte, así que no cabe en `domain`. Se enchufa al proveedor de Hocuspocus como su clase WebSocket.
- Un participante que se cae sucio desaparece a los **30 s**, la misma tolerancia que el latido del host. Hocuspocus trae 60 s por defecto.

### D3 — Forma del relay (la decisión más importante de la rama)

El host no acepta conexiones entrantes, así que el orquestador no puede abrir una conexión hacia él por cada invitado. Hay dos formas de resolverlo.

| Opción | Cómo funciona | Conexiones por sala |
|--------|---------------|---------------------|
| **a** Multiplexar | Una sola conexión host↔orquestador; cada mensaje lleva un identificador de conexión del invitado | 1 |
| **b** Túnel inverso | Una conexión de **control** permanente; cuando entra un invitado, el orquestador avisa y el host **abre una conexión de datos saliente** para ese invitado. El orquestador une las dos puntas | N+1 |

**Decisión: (b) túnel inverso.**

**Corregido el 2026-10-04 contra la documentación oficial de Hocuspocus v4.** La justificación anterior decía que multiplexar obligaba al host a *emular un socket* por invitado, y que eso era la parte frágil. **Eso era cierto en la v3 y ya no lo es.** En la v4, `handleConnection(incoming, request, context?)` acepta cualquier `WebSocketLike` —solo exige `send`, `close` y `readyState`— y devuelve un `ClientConnection` al que el integrador le entrega los mensajes con `handleMessage` y `handleClose`. Es el camino oficial para Bun, Deno y Cloudflare Workers.

Consecuencia: **las dos opciones necesitan la misma fontanería**, porque en ninguna la conexión del invitado la acepta un servidor nuestro, así que en ninguna se puede usar el servidor integrado de Hocuspocus.

La decisión se mantiene por una razón distinta: **aislamiento de la congestión**.

| | Multiplexar | Túnel inverso |
|---|---|---|
| Invitado con mala red | Su cola llena el socket compartido y **atasca a todos** | Solo se atasca él |
| Control de flujo | A mano, por invitado, sobre un socket común | Lo da TCP |
| Emparejamiento | No hace falta | Ticket con caducidad |

Un atasco de cabeza de línea se manifiesta como "a veces la pizarra se pone lenta para todo el equipo", intermitente y sin culpable visible. Los fallos del emparejamiento, en cambio, se ven y se prueban: el invitado recibe un error con causa. Se prefiere el modo de falla visible.

Costos aceptados: una ida y vuelta extra al entrar —una sola vez por invitado— y N+1 conexiones por sala.

**Verificación de B5 resuelta.** Ya se sabe cómo se entrega una conexión al servidor de sala: `handleConnection` con un `Request` estándar de la web que el host construye a partir del identificador de sala, más el reenvío manual de mensajes y cierre. Hocuspocus v4 exige Node 22 o superior; las máquinas tienen 24. Nota para H3: su extensión de SQLite ahora usa `better-sqlite3`.

En las dos opciones el mensaje viaja **binario**, sin envolverlo en texto: el documento compartido ya es binario y meterlo en JSON lo infla sin ganar nada.
**Bloquea:** pasos B1, B3 y B4. Es la primera que hay que confirmar.

### D4 — Identificador de sala y token del link

| Opción | Consecuencia |
|--------|--------------|
| **a** El identificador de sala es también el secreto del link | Un identificador que aparece en un log es acceso a la sala |
| **b** Identificador de sala para enrutar, **token de invitación** aparte para entrar | Se puede revocar o rotar sin cambiar la sala; M16 ya lo va a necesitar |

**Decisión: (b) token de invitación aparte.** Cuesta poco ahora y mucho después. Nota de seguridad: si el token viaja en el link, conviene que vaya en el fragmento de la URL —después de `#`— porque esa parte no se envía al servidor ni se filtra por el encabezado de referencia.
**Bloquea:** paso B2.

### D5 — El host reconecta y su sala sigue registrada

Pasa siempre: el host se suspende, el orquestador todavía no detectó la caída, el host vuelve y su identificador ya está ocupado.

| Opción | Consecuencia |
|--------|--------------|
| **a** Rechazar hasta que expire el latido | La sala queda muerta varios segundos por un registro fantasma |
| **b** Quien presente el **token de host** correcto reemplaza el registro anterior y la conexión vieja se cierra | Recuperación inmediata; exige que el host tenga un token estable |

**Decisión: (b) reemplazar con token de host.** El rechazo de la fila "dos hosts reclaman la misma sala" del v2 aplica a un host **distinto**, no al mismo host volviendo. Reemplazar no agrega riesgo: quien tiene el token de host ya podría suplantarlo.
**Bloquea:** paso B2.

### D6 — Cuántas salas por proceso host

En la v1 un proceso host registra **una** sala. El protocolo igual lleva el identificador de sala en cada mensaje, así que soportar varias después no cambia el contrato.

Aclaración para no confundir: "varias sesiones a la vez" en la interfaz significa que una persona participa en varias salas, no que aloje varias.
**Bloquea:** paso B1.

### D7 — Dónde se sirve la web

El v2 dice que el orquestador sirve la web. En desarrollo no: cada app tiene su propio proceso y su URL de portless, que es como está montado el arranque. Entonces el link apunta a la web, y la web abre su conexión al orquestador.

**Decisión, confirmada el 2026-10-04:** el link es `https://<web>/s/<identificador>#<token>`. El token va en el fragmento, que el navegador no manda a ningún servidor: no queda en historiales de proxy ni en logs.
**Bloquea:** paso B6.

Decisiones que salieron al aterrizarla en B6:

- **"Volverme host" le pide la invitación al host de mi máquina.** El navegador no arranca procesos: el host se sigue arrancando con `pnpm dev` (más adelante `space host`). El host expone `GET /invitacion` con sala y token de invitación, **nunca** el token de host. Solo responde a peticiones desde la propia máquina y al origen de la web configurado; sin eso, cualquier página abierta en el navegador podría leer el token.
- **El rol viaja en la presencia** (host o invitado) y se muestra en la lista. **Es falsificable hasta B8**, que lo resuelve donde no se puede falsificar. *Resuelto en B8:* el host decide el rol por el token de la web del host y lo sella en la presencia; el invitado pasó a llamarse espectador. Ver "Roles" en el README de la rama.

### D8 — Runner de pruebas

| Opción | A favor |
|--------|---------|
| **a** El runner integrado de Node | Sin dependencias; suficiente para paquetes de servidor |
| **b** Vitest | Mismo runner para la web y para los paquetes; la web ya usa Vite |

**Decisión: (b) Vitest.** Un solo comando y un solo estilo en todo el monorepo, web incluida.
**Bloquea:** paso A4.

### D9 — Dónde se guarda el nombre del participante

Se pide al entrar y se recuerda en el navegador para la próxima. No se replica ni se persiste en el host más allá de la sesión y de la lista de participantes del commit.

**Decisión, confirmada el 2026-10-04:** se guarda en el `localStorage` del navegador y viaja solo en la presencia de Yjs.
**Bloquea:** paso B6.

---

## 4. Modelo extensible del relay

Bloque obligatorio de `agent-extensible-capability-design.mdc`.

```
Mecanismo de la capacidad: transportar los mensajes de una sala entre sus
  participantes y el contenedor host que es su dueño, enrutando por identificador
  de sala.

Variantes de hoy: canal de sesión (documento compartido y presencia).

Variantes probables siguientes: canal de réplica de la base local (H4 y H5),
  canal de control (estados de publicación, aviso de sala cerrada),
  canal de adjuntos.

Módulo dueño: M5 relay, en el orquestador. El contrato del sobre y de los
  canales vive en packages/domain, no en el orquestador ni en el host.

Plugins: cada canal declara su identificador y su manejador dentro del host.

Prueba de extensión: agregar el canal de réplica = un miembro más en la unión
  de canales y su manejador en el host. Sin endpoints nuevos, sin cambios en el
  orquestador, sin un segundo túnel.

Patrón existente a extender: ninguno — es el primer código del motor.
```

**Consecuencia directa:** nada en el orquestador se llama "pizarra" ni "sesión de dibujo". El orquestador no sabe qué transporta. Si en el código del relay aparece una palabra de la pizarra, está mal puesta.

---

## 5. Riesgos de esta rebanada

| # | Riesgo | Cómo lo atacamos | Cuándo se verifica |
|---|--------|------------------|--------------------|
| R1 | El proxy de desarrollo no pasa la actualización a WebSocket y perdemos días creyendo que el bug es nuestro | Probar un eco por WebSocket a través del proxy **antes** de construir nada | Paso A3, el primero |
| R2 | El transporte del relay no encaja con lo que el servidor de sala espera de un cliente | **Cerrado el 2026-10-04:** Hocuspocus v4 acepta cualquier `WebSocketLike` vía `handleConnection` y devuelve un `ClientConnection` al que se le reenvían los mensajes. Ver D3 | Resuelto en documentación; se ejercita en B5 |
| R3 | NAT real sin probar hasta el final | Prueba con dos redes en cuanto el eco cruce el relay, no al cerrar la épica | Paso B3 |
| R4 | Salas fantasma en el registro y fuga de memoria | Latido con corte por inactividad y baja al cerrar; prueba que cuenta salas vivas | Paso B2 |
| R5 | Tormenta de reconexión: todos vuelven al mismo instante | Espera creciente con variación aleatoria, tope máximo | Paso B7 |
| R6 | Node ejecuta TypeScript quitando los tipos, sin transformarlos: `enum`, `namespace`, propiedades de constructor y decoradores **no funcionan** | El contrato usa uniones de literales y tipos planos. Queda escrito en el README de la rama | Paso A5 |
| R7 | Un invitado lento retiene memoria del orquestador | Límite de cola por conexión; se cierra a quien no drena | Paso B3 |
| R8 | Construir presencia propia y tirarla en H2 | Decisión D2 opción (a) | Paso B5 |
| R9 | El contrato del relay se contamina con vocabulario de pizarra | Revisión del bloque de mecanismo al cerrar la épica | Cierre |

## 6. Qué queda fuera de esta rama

- Lienzo y dibujo — H2.
- Persistencia del documento de la sesión y restauración — H3.
- Staging, commits, historial — H4.
- Base local replicada y CLI — H5.
- Autenticación, link privado, expulsar participantes.
- Sala global en servidor — H7.

Si algo de esta lista aparece en un diff de esta rama, está fuera de alcance.

## 7. Qué hay que confirmar antes de empezar

D1, D3 y D8 están confirmadas. Faltan, en orden de urgencia: **D4** (token del link separado del identificador de sala) y **D5** (qué pasa cuando el mismo host reconecta), las dos antes del paso B2. **D2** antes de B5, y **D6**, **D7** y **D9** en el paso donde aparecen.
