# Análisis — Quitar RxDB, evaluar PowerSync y React Native

Rama: `dev/motor`. Fecha: 2026-10-19.

Propuesta de David: dejar RxDB por su costo, meter **PowerSync** como base local y réplica, y hacer el frontend con **React Native**. Este documento revisa cómo encaja cada pieza con el diseño vigente y qué decisiones cambia.

## Estado

**Decidido el 2026-10-19 por David; falta la revisión de Kua.**

| Decisión | Resultado |
|---|---|
| S1 — Opción de datos | **D: PowerSync central alimentado solo por el host.** RxDB sale del diseño |
| S4 — React Native | **Primero la prueba de concepto** (PdC 1). La web sigue en Vite hasta que se decida |

Ya está promovido a los documentos fijos: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md) (secciones 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14 y 15), [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md), [por-que-no-microservicios.md](../../../fijos/arquitectura/por-que-no-microservicios.md), [estructura-del-proyecto.md](../../../fijos/estructura-del-proyecto.md), el encabezado de [arquitectura-recomendada.md](../../../fijos/arquitectura/arquitectura-recomendada.md) y la regla `.cursor/rules/arquitectura-harukoia.mdc`. Las pruebas de concepto están en [plan-pdc-stack-powersync-react-native.md](./plan-pdc-stack-powersync-react-native.md).

Lo de abajo es el análisis que llevó a la decisión.

---

## 1. Estado actual

| Hecho | Dónde |
|---|---|
| RxDB **no está instalado** en ningún paquete. El código usa Yjs y Hocuspocus para la sala, y React con Vite para la web | `package.json` de cada app y paquete |
| La v2 deja a RxDB dos papeles: base del host (commits, snapshots, documentos) con SQLite, y caché del invitado con Dexie | v2, sección 5 |
| La entrega al resto del equipo va **por git**, no por una réplica de base de datos | v2, secciones 6 y 8 |
| La réplica que queda es del host hacia los invitados de su sala: historial (H4-T9) y estados del push (H5-T7) | [fase 1](../../../fijos/fases/fase-1-modulos-y-tareas.md), M3 |
| "Licencia del almacenamiento en disco de la base local" ya era una decisión que bloquea H5 | fase 1, sección 13 |
| La persistencia de la sala en H3 es el documento Yjs en SQLite del host. No usa RxDB | v2, sección 5; nota de D3 en el análisis de H0–H1 |
| La aplicación móvil está **fuera de la v1** | v2, sección 14; fase 1, sección 14 |

Costo de RxDB, según su página: el SQLite de producción está en el plan **Pro, 99 dólares al mes con facturación anual**, sin prueba gratis. La versión de prueba que viene en el núcleo topa en 500 documentos y no es para producción.

**Consecuencia:** hasta H4 nada depende de RxDB. La decisión no bloquea H2 ni H3.

---

## 2. Cómo funciona PowerSync

Fuente: documentación oficial (`docs.powersync.com`), revisada el 2026-10-19.

| Pieza | Qué hace |
|---|---|
| **Base fuente** | Postgres, MongoDB, MySQL, SQL Server o Convex, en un servidor. **SQLite no es una base fuente soportada** |
| **PowerSync Service** | Lee la base fuente por captura de cambios (en Postgres, replicación lógica). Guarda una copia de los datos más su historial de operaciones en un **almacén de buckets** (MongoDB o Postgres). Hace streaming a los clientes. Nunca consulta la base fuente para servir a un cliente |
| **Cliente** | SQLite local. Las lecturas son locales. Las escrituras van a una **cola de subida** que el SDK entrega a una función `uploadData()` nuestra, que llama a **nuestro backend**. El backend valida y escribe en la base fuente, y el cambio regresa a todos por el stream |
| **Autenticación** | JWT firmado por nosotros (JWKS o HS256), con vida máxima de 60 minutos |

Propiedades que importan aquí:

- El modelo es **server-authoritative**: si la base fuente no recibe una escritura, el cliente la revierte en el siguiente checkpoint.
- Conflictos: por defecto **gana la última escritura**, por campo. No es un CRDT. Para texto o tableros, la documentación propone guardar updates de Yjs como filas (hay una demo con Tiptap).
- El endpoint de escritura tiene que ser **síncrono** con la base fuente. Nada de encolar para después.
- Montaje mínimo autoalojado: un contenedor de 512 MB y 1 vCPU, más MongoDB en modo réplica con 2 GB. La API del servicio necesita **un subdominio propio**. Hay guía para desplegarlo en Coolify.

Licencias y costo:

| | Licencia | Costo |
|---|---|---|
| PowerSync Service (Open Edition, autoalojado) | FSL-1.1-ALv2: código disponible, se vuelve Apache 2.0 con el tiempo | Gratis |
| SDK de cliente (Web, React Native, Node y otros) | Apache 2.0 | Gratis |
| PowerSync Cloud | — | Plan gratis con límites; Pro desde 49 dólares al mes |

Los *custom checkpoints* (tuberías de datos propias delante de PowerSync) **no** vienen en la Open Edition.

---

## 3. Dónde encaja PowerSync con nuestra arquitectura

El punto de fricción: PowerSync supone **una base central en un servidor**, y la v2 dice que **no hay maestro central** y que el dueño de los datos es el host, normalmente en una laptop detrás de NAT.

### Opción A — PowerSync central, que es como lo diseñaron

Postgres y PowerSync en Makino Hara; clientes y host contra esa base.

- A favor: es el uso documentado; el móvil y la web reciben los datos sin pasar por el relay.
- En contra: la base central se vuelve la verdad. Reabre "no hay maestro central" y el papel del host como dueño de los datos.

### Opción B — PowerSync dentro de cada contenedor host

- A favor: el host sigue siendo dueño.
- En contra: cada host corre Postgres con replicación lógica, el servicio, su almacén de buckets y emisión de JWT. Y el invitado tendría que llegar al servicio **a través del relay**, que hoy solo tuneliza WebSocket con nuestro saludo propio. No está verificado que el SDK acepte un transporte propio, y el servicio pide un subdominio propio.

### Opción C — Sin RxDB y sin PowerSync en la pizarra

- SQLite gratis en el host, que además ya llega con la persistencia de Hocuspocus en H3.
- El historial y los estados del push viajan a los invitados por un **canal de réplica** del relay. El relay ya se diseñó con ese canal como su siguiente variante (bloque de mecanismo del análisis de H0–H1).
- En contra: un protocolo chico escrito a mano (traer desde un checkpoint, stream de novedades, reenganche). Los invitados solo ven el historial mientras el host está encendido.
- PowerSync se reserva para los módulos de IOKOIA Space, donde sí hay un servidor central natural.

### Opción D — PowerSync central alimentado por el host (pregunta de David)

> ¿Se podría un PowerSync central que guarde los datos en el SQLite del host? Que se mantenga la idea de que los hosts sean los que alimentan la información, y que PowerSync sea central únicamente para replicar.

**Tal cual, no.** Por tres razones, todas de la documentación:

1. **SQLite no es una base fuente.** El servicio lee de Postgres, MongoDB, MySQL, SQL Server o Convex.
2. **El servicio se conecta a la base fuente**, no al revés. Con el host detrás de NAT, PowerSync no puede alcanzar el SQLite de una laptop.
3. **El servicio guarda su propia copia** de los datos y su historial en el almacén de buckets. "Central solo para replicar" implica, de todas formas, una copia central.

**La variante que sí funciona** con la misma idea:

```text
  Host (laptop)                         Makino Hara
  ┌────────────────────────┐            ┌─────────────────────────────┐
  │ SQLite de PowerSync    │  saliente  │ Backend de escritura        │
  │ (SDK de Node)          │──────────► │  solo acepta el token       │
  │ cola de subida         │            │  de host de esa sala        │
  └────────────────────────┘            │          │                  │
                                        │          ▼                  │
                                        │ Postgres (copia central)    │
                                        │          │ replicación      │
                                        │          ▼                  │
                                        │ PowerSync Service           │
                                        └──────────┬──────────────────┘
                                                   │ stream
                                   web, móvil, CLI ◄┘  (solo lectura)
```

- El host usa el **SDK de Node** de PowerSync. Su SQLite local es la base que administra PowerSync. Escribe ahí, y la cola de subida manda los cambios **hacia fuera** al backend central. Funciona detrás de NAT como el registro de salas.
- El backend central **solo acepta escrituras del host de esa sala**. La regla "solo el host comitea" se valida ahí.
- Los invitados, el móvil y el CLI **leen** de PowerSync central. No pasan por el relay, así que desaparece el problema de transporte de la opción B.
- Si el host se queda sin red, sigue escribiendo local; la cola sube al volver.
- Si el host se apaga, **quien no estuvo sigue viendo el historial y los estados**. Eso está alineado con el contexto inicial ("conciencia del trabajo incluso fuera de la pizarra").

Qué cambia en el diseño, para decidirlo de forma explícita:

| Decisión vigente | Con la opción D |
|---|---|
| No hay maestro central de documentos; el host persiste | Hay una **copia central de lectura**. El host es el único que escribe, pero técnicamente la verdad de PowerSync es el Postgres central: una escritura que el backend rechace se revierte en el host |
| El servidor de la nube no guarda el tablero | Se separa: el **orquestador** sigue sin guardar nada. Un proceso nuevo de réplica sí guarda historial, estados y lo que se decida subir |
| Dos contenedores | Se agregan Postgres, PowerSync, su almacén de buckets y el backend de escritura en Makino Hara. Hay que pasarlo por el criterio de [por-que-no-microservicios.md](../../../fijos/arquitectura/por-que-no-microservicios.md) |

Preguntas que la opción D deja abiertas:

1. **Qué sube a la copia central**: solo metadatos (commits, autores, estados del push) o también el snapshot Yjs y el JSON del tablero. Lo segundo pone el tablero en la nube.
2. **Dónde vive el backend de escritura**: dentro del orquestador (cambia su papel) o como proceso propio.
3. **Si el CLI deja git** para `space update` y lee de PowerSync, o si git sigue siendo la entrega. La v2 hoy dice git.
4. **El almacén de buckets**: MongoDB o Postgres. Con Postgres, el mismo servidor sirve para los dos papeles.

---

## 4. React Native

| Tema | Hallazgo | Fuente |
|---|---|---|
| tldraw | Solo funciona sobre el DOM. En el teléfono corre dentro de un WebView, con los componentes DOM de Expo (`'use dom'`). Hay un ejemplo público de tldraw montado así | Documentación de Expo; repositorio `byCedric/tldraw-dom-components` |
| Limitaciones del WebView | Gestos y desplazamiento menos fluidos que lo nativo; se limita en modo de ahorro de energía; motor de JS aparte con un arranque más lento; árbol de React y contexto separados del nativo; las actualizaciones OTA no alcanzan a los componentes DOM | Blog de Expo sobre los componentes DOM |
| Host en el teléfono | **No.** El contenedor host necesita Node, git, pandoc y la copia del repo. En el móvil solo se entra como espectador o a una sala global | v2, secciones 4 y 9 |
| Web | Pasaría de Vite a Expo web (react-native-web y Metro). Las pantallas de B6 (unas 800 líneas en `apps/web/src`) se reescriben con componentes de React Native | Código de `apps/web` |
| APIs del navegador en el código | `localStorage`, `sessionStorage`, `window.location` y `history` en la web; `crypto.getRandomValues` en `packages/domain/src/identificador/`. En el teléfono hay que verificar cada una | Código |
| Link de invitación | `https://<web>/s/<sala>#<token>` necesita configurar los enlaces que abren la app, y comprobar que el fragmento sobrevive | Análisis de H0–H1, D7 |
| Monorepo | Expo acepta pnpm con dependencias aisladas desde el SDK 54 | Guía de monorepos de Expo |
| PowerSync en React Native | Necesita `op-sqlite`, así que no corre en Expo Go: pide un build de desarrollo. El adaptador para Expo Go está en alfa y no persiste de forma fiable. El soporte en web de React Native está en **beta** | Documentación de PowerSync |
| Arranque con PM2 y portless | Metro y el teléfono no encajan directo con `pm2-portless-run`, y la regla de este repo prohíbe pasar banderas de puerto al proceso. Hay que resolverlo antes de agregar la app | `.cursor/rules/pm2-dev.mdc` |

Choques con lo documentado:

1. La v2 y la fase 1 dejan la **aplicación móvil fuera de la v1**.
2. La v2 (sección 9) pide la línea visual de IOKOIA Space (React DOM, Tailwind, Base UI/shadcn, Lucide) para que migrar pantallas sea **traer comportamiento, no rediseñar**. En React Native ese régimen se rehace (NativeWind, lucide-react-native, react-native-reusables) y las pantallas de IOKOIA, que son Next.js, ya no se traen tal cual.

Lo que sí queda a favor: un solo código para web y móvil, y el móvil como superficie natural de los módulos de IOKOIA (tareas, calendario, metas) junto con PowerSync.

---

## 5. Pruebas de concepto antes de decidir

Decisión de David del 2026-10-19: **React Native pasa primero por una prueba de concepto.** Lo mismo se propone para PowerSync. Ninguna toca `apps/web`, `apps/host` ni `apps/orchestrator`: van aisladas, y lo que no se adopte se borra.

### PdC 1 — tldraw en Expo conectado a una sala real

| | |
|---|---|
| Qué | App Expo mínima: pantalla de nombre y de unirse, y tldraw dentro de un componente DOM, conectada a una sala por `cliente-del-relay` y el proveedor de Hocuspocus |
| Pasa si | 1. Un trazo hecho en el navegador aparece en el teléfono y al revés, sobre el orquestador de Makino Hara. 2. La misma app corre en web. 3. El link abre la sala en el teléfono. 4. Los paquetes del monorepo (`domain`, `cliente-del-relay`) resuelven sin copiarlos |
| Se mide | Latencia de un trazo hasta el teléfono; fluidez del lienzo con el dedo; tiempo de arranque del WebView |
| Bloquea | H2: dónde se monta el lienzo |

### PdC 2 — PowerSync con la opción D

| | |
|---|---|
| Qué | Postgres, PowerSync Service y un backend de escritura mínimo en Docker; un host con el SDK de Node que escribe un commit de prueba; un navegador que lo lee |
| Pasa si | 1. El host escribe sin red y la cola sube al volver. 2. Un cliente sin token de host no puede escribir. 3. El navegador ve el commit sin pasar por el relay. 4. Apagar el host no le quita el historial a quien lo lee |
| Bloquea | H4 y H5: M3, base local y réplica |

---

## 6. Qué toca en el plan

| Épica | Efecto |
|---|---|
| H2 | Espera el resultado de la PdC 1 para saber dónde se monta tldraw |
| H3 | Sin cambio: la persistencia del documento Yjs es SQLite en el host |
| H4, H5 | Dependen de la opción de datos (A, B, C o D) |
| H7 | Con la opción D, la sala global y la copia central comparten servidor |

Documentos que se editarían al confirmar el cambio:

- v2: secciones 1, 2, 4, 5, 9, 11, 14 y 15.
- `arquitectura-recomendada.md`: el encabezado de lo que quedó superado.
- `por-que-no-microservicios.md`: menciona RxDB y, con la opción D, cambia la lista de procesos.
- Fase 1: M3, H4-T9, H5-T2 y H5-T3, el bloqueo de la licencia, y lo que queda fuera de la fase.
- `estructura-del-proyecto.md`, y `.cursor/rules/pm2-app.mdc` si entra una app nueva.
- `acuerdos-junta-fase2.md` **no** se toca: es la minuta de la junta.

## 7. Decisiones pendientes

| # | Decisión | Quién | Antes de |
|---|---|---|---|
| S1 | ~~Opción de datos: A, B, C o D~~ — **D**, decidida el 2026-10-19 | David | — |
| S2 | Con D: qué sube a la copia central (metadatos o también el tablero) | David y Kua | PdC 2 |
| S3 | Con D: dónde vive el backend de escritura | David y Kua | PdC 2 |
| S4 | Si React Native entra en la v1, según el resultado de la PdC 1 | David y Kua | H2 |
| S5 | Cómo se arranca la app Expo con PM2 y portless | David y Kua | Agregar la app |
| S6 | Quién emite el token de lectura (JWT) de PowerSync, contra qué credencial de la sala y con qué alcance | David y Kua | PdC 2 |
| S7 | Almacén de buckets de PowerSync: MongoDB o Postgres | David y Kua | PdC 2 |
| S8 | Si las reglas del contrato de A5 (orden por `actualizadoEn`, borrado lógico, migración al leer) se ajustan al modelo de PowerSync | David y Kua | H4 |
| S9 | Si `space update` baja de git o lee de la réplica central | David y Kua | H5 |
| S10 | Rama y carpeta donde viven las pruebas de concepto | David | Antes de la PdC 1 |
