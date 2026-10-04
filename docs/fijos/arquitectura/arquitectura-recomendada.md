# Arquitectura recomendada — Motor colaborativo HaruKoia

> Documento superado en varios puntos por el [análisis de arquitectura v2](./analisis-arquitectura-v2.md), que recoge los acuerdos de la junta de Fase 2. Cambiaron: el maestro MongoDB (se eliminó), los roles de host y espectadores, el momento en que se genera el markdown, el versionado de la pizarra, la separación en orquestador y contenedor host, y la identidad de la v1. Lo demás sigue vigente.

Decisión de arquitectura del motor que se construye en este repositorio, desde cero. IoKoia Space no se modifica. Cuando el motor esté funcionando, sus módulos se traen hacia acá, uno por uno.

## Decisión

El motor es una aplicación **local-first**, en un **monorepo TypeScript**, con estos procesos:

| Proceso | Tecnología | Responsabilidad |
|---|---|---|
| Web | React, tldraw, RxDB (Dexie) | Pizarra, presencia y lectura de lo publicado |
| Sync | Yjs + Hocuspocus | Sesión de pizarra entre varias personas, en vivo |
| Réplica | NestJS + MongoDB | Identidad, pull / push / stream de RxDB, orden de publicar |
| Worker | Node, cola, Pandoc, modelo de IA | Markdown, PDF y Word, fuera de la sesión |
| CLI | Node + RxDB | `space update` y, después, el resto de comandos que hoy viven en `iokoia space` |

El markdown publicado es una **versión nueva** dentro de RxDB. El CLI, al replicar, lo escribe como archivo en el repositorio. La pizarra en vivo no viaja por esa réplica: viaja por Yjs.

Esa separación es el núcleo de la decisión. Todo lo demás (robustez, escala, migración, estilo de interfaz) sale de respetarla.

## Alcance que fija esta decisión

### Ahora: HaruKoia

- Pizarra interactiva, varias personas a la vez, con conciencia de quién está y en qué.
- Publicar la sesión.
- Convertir esa publicación en markdown con IA.
- Exportar el mismo markdown a PDF y Word.
- Base local en cada dispositivo y réplica al resto de la organización.
- CLI que actualiza la documentación del repositorio sin abrir la web.

Es software interno para equipos de desarrollo. El formato de salida está pensado para código, agentes y repositorios.

### Después: traer IoKoia Space hacia este motor

El código actual de IoKoia Space permanece en `iokdev-cli` hasta que cada módulo se reimplemente aquí. El orden lo marca el producto, no este documento. Los módulos que existen allá y que este motor tiene que poder recibir son:

- Sistema de diseño (tipologías, relaciones, mapa).
- Git.
- Tareas.
- Minutas.
- Calendario.
- Correo.
- Agentes de IA.
- Depuración.
- Metas.
- Procedimientos.
- Entidades.
- Autenticación (Authentik, OIDC).

Cada uno entra como colecciones, pantallas y comandos del mismo motor. No entra como un servicio nuevo.

## Estilo de la arquitectura

El estilo es **local-first con un motor modular**.

- **Local-first.** Cada navegador y cada CLI tienen su base. La consulta no espera al servidor. Sin red se sigue leyendo y se siguen preparando cambios. Al volver la red, la réplica se pone al día desde un checkpoint.
- **Modular.** Una función nueva es un módulo: esquema, pantalla y, si aplica, un comando. Comparte identidad, réplica y presencia con el resto.
- **Dos tiempos de dato.** El trazo de la pizarra es inmediato y se fusiona solo (CRDT de sesión). La publicación, el markdown, el PDF y el aviso a los demás dispositivos es un documento que se replica después.
- **Versión inmutable al publicar.** Publicar crea un documento nuevo. No reescribe la publicación anterior. Dos juntas no se pisan.
- **Un repositorio de código.** Web, sync, réplica, worker y CLI comparten el esquema JSON. El monorepo organiza el código. No significa un solo proceso.

## Vista de funcionamiento

```text
Persona A y persona B
        │
        ▼
   Web (RxDB local + tldraw)
        │                         │
        │ sesión en vivo          │ documentos publicados
        ▼                         ▼
   Sync (Yjs)                Réplica (NestJS)
        │                         │
        │ snapshot al publicar    │ MongoDB (maestro de la réplica)
        └──────────► Worker ──────┘
                     IA + Pandoc
                         │
                         ▼
                    CLI de cada persona
                    RxDB local → archivos .md en el repo
```

1. Quienes están en la junta comparten el tablero por el proceso de sync. La presencia (quién y en qué space) viaja en el mismo canal.
2. Publicar congela un snapshot del tablero y deja el trabajo en una cola.
3. El worker produce el markdown y, a partir de ese mismo texto, el PDF y el Word.
4. Esas piezas se guardan como versión nueva en el maestro de la réplica.
5. El navegador y el CLI las reciben por pull y por el stream en vivo.
6. El CLI materializa el markdown (y los adjuntos que correspondan) en el checkout. Agentes y git leen archivos, no la base local.

## Por qué esta forma y no las alternativas que revisamos

### Motor nuevo en este repositorio, frente a extender `iokdev-cli` ahora

Extender Space hoy sería más corto para una pantalla suelta. Se descartó porque el objetivo es un motor completo, y IoKoia Space se migra hacia él cuando ese motor ya funcione. Construir la pizarra dentro del hub actual ata el diseño a un proceso por máquina, a archivos vigilados con chokidar y a un Next que embebe Nest. Sacarlo después costaría más que empezar con el contrato correcto.

`iokdev-cli` queda como mapa de dominio: qué módulos existen, cómo se llama una minuta, qué hace `iokoia space`, qué proveedor de identidad usa la organización (Authentik). No es el sitio donde se escribe este motor.

### Monorepo, frente a un repositorio por proceso

El monorepo es el lugar del código. Los procesos de la tabla de arriba se despliegan por separado.

Hace falta un solo esquema de documento (space, versión, markdown, adjunto) usado por la web, el worker y el CLI. En repositorios separados ese esquema se copia y se desfasa en cuanto entra el siguiente módulo de IoKoia. En un monorepo el paquete de esquemas es la dependencia común.

### Módulos dentro del motor, frente a microservicios desde el primer día

Los microservicios resuelven un equipo que despliega solo, una escala distinta, un almacén propio o un fallo que no puede tumbar al resto. HaruKoia todavía no tiene esas cuatro condiciones repartidas en diez funciones: las propuestas siguientes aún no están cerradas. Dibujar un servicio por función ahora fijaría fronteras que la migración de IoKoia va a cruzar (una meta se relaciona con un procedimiento, una minuta con un repositorio, un agente con un checkout).

El camino que sigue esta decisión:

1. La función nace como módulo del motor (esquema RxDB + pantalla + comando).
2. Se extrae a proceso propio solo si cumple una de estas condiciones: se despliega a otro ritmo, pide mucha más capacidad que el resto, debe guardar datos que el resto no debe leer, o su fallo no puede cortar la pizarra ni la réplica.

Eso ya está aplicado en el corte inicial. Sync, réplica y worker son procesos distintos porque sí cumplen esas condiciones hoy:

| Proceso | Por qué no vive dentro de los otros |
|---|---|
| Sync | Escala por conexiones abiertas. Un reinicio no puede esperar a Pandoc ni a Mongo. |
| Réplica | Escala por documentos y clientes suscritos. Es el maestro que el CLI consulta con la laptop de la otra persona apagada. |
| Worker | La llamada al modelo y Pandoc son lentos y fallan por causas distintas. No pueden bloquear un trazo ni un pull. |

Una ficha genérica de “plataformas colaborativas” pide además API Gateway, Kafka o RabbitMQ, gRPC y un NoSQL de historial de chat. Esa ficha describe, juntas, un chat público de escala masiva y un editor de documentos, y ella misma pregunta cuál de los dos es el producto. HaruKoia es una pizarra cuya salida es un documento de equipo. De esa ficha se toma el canal WebSocket para la sesión y una cola para lo que ocurre después de publicar. El gateway entra cuando haya varios servicios HTTP que enrutar. gRPC no es el protocolo del navegador en la pizarra. Un historial de mensajes no es el artefacto que hay que conservar.

Kafka reparte un registro para que otro proceso lo lea después. El trazo tiene que llegar al otro navegador en el acto, por el documento compartido de Yjs. La cola (Redis + BullMQ) entra en el worker: publicar, generar, exportar.

Esta lectura coincide con la forma en que productos grandes separan de verdad: lo que se escribe junto se mantiene detrás de una frontera de módulo, y solo se saca por red lo que ya se puede escalar y desplegar solo. Empezar el proyecto ya como malla de servicios, antes de conocer el dominio que va a llegar con IoKoia, es el caso que esa experiencia desaconseja.

### RxDB, frente a PostgreSQL como única fuente y frente a “solo archivos en git”

PostgreSQL como única base obligaría a que cada lectura de la web y del CLI pase por la red, o a construir a mano la copia local, los checkpoints y los conflictos. Los archivos en git son el destino que agentes y repositorios ya saben leer, y no alcanzan para la réplica entre dispositivos ni para consultar sin abrir el repo.

RxDB cubre las tres cosas con un solo modelo:

- Base local en el navegador y en el CLI.
- Réplica en tiempo real con tres operaciones de servidor: `pull` (cambios desde un checkpoint), `push` (escrituras locales) y `pullStream` (eventos mientras hay conexión, por WebSocket). Si el stream pierde eventos, un `RESYNC` obliga a recorrer de nuevo el checkpoint.
- El servidor guarda el maestro. MongoDB encaja porque RxDB trae un almacenamiento de servidor sobre MongoDB, y el documento ya es JSON con esquema.

El CLI no sustituye al archivo. Después de replicar, escribe `.md` (y adjuntos) en el checkout. Git sigue siendo la copia que el equipo revisa. RxDB es la copia de trabajo que se mantiene al día aunque la persona no haya hecho pull de git.

Conflictos. El manejador por defecto de RxDB se queda con el estado del servidor y descarta el del cliente que estuvo mucho tiempo fuera de línea. Para un markdown que dos personas editan a la vez, eso pierde trabajo. Por eso publicar crea una versión nueva e inmutable: la réplica casi no tiene que fusionar el mismo documento. El plugin CRDT de RxDB (operadores `$set`, `$inc`, `$push`) sirve para campos que se pueden describir así, por ejemplo contadores o listas. RxDB documenta que ese plugin no es Yjs ni Automerge, y que no aplica cuando hace falta unir una interacción libre. La pizarra es ese caso.

### Yjs en la sesión, frente a meter el tablero en la réplica de RxDB

Yjs está separado del transporte y de la persistencia: el documento compartido se puede servir por WebSocket y guardar después. El backend oficial de escala (varios nodos de sync, Redis para repartir actualizaciones, un worker que persiste) existe precisamente porque una base normal no aguanta cientos de operaciones de dibujo por segundo.

Hocuspocus es el servidor de Yjs adecuado para el primer corte: autenticación en el hook de conexión, persistencia del documento y presencia. Cuando haya más de un nodo de sync, el fan-out pasa a Redis, siguiendo ese mismo patrón, sin cambiar el cliente.

La sesión guarda su binario de Yjs para sobrevivir un reinicio del sync. Al publicar, el snapshot y el markdown resultante son documentos de RxDB. A partir de ahí manda la réplica, no el canal de la pizarra.

### tldraw, frente a un lienzo propio

El valor del motor está en publicar, convertir a markdown y replicar al CLI. Un lienzo propio consumiría el tiempo de ese valor. tldraw aporta formas, selección, cámara y un modelo de escena integrable con Yjs. El marco alrededor (spaces, presencia, publicar, historial) es de este producto.

### Cola de trabajos, frente a generar el markdown dentro del request de publicar

Publicar tiene que responder en cuanto el snapshot quedó aceptado. La llamada al modelo y Pandoc tardan, fallan y se reintentan. Van a un worker con cola. El cliente ve el estado de la versión (`en proceso`, `publicada`, `falló`) porque ese estado es un documento replicado, no un spinner atado a la conexión de quien publicó.

## Piezas

### Web

- React.
- tldraw para el tablero, con un proveedor de Yjs.
- RxDB con almacenamiento Dexie (IndexedDB). Sirve para el corte abierto sin el paquete de pago. Si el volumen de documentos locales lo pide, se cambia al almacenamiento IndexedDB u OPFS del paquete de pago de RxDB. El esquema no cambia: solo el adaptador.
- Consultas reactivas: la lista de versiones y el estado de una publicación se actualizan cuando llega la réplica, también con la pestaña en segundo plano.

### Sync

- Un proceso Hocuspocus.
- Auth en la conexión: solo entra quien pertenece a la organización y al space.
- Presencia por el protocolo de awareness de Yjs: identidad, space y foco. Es la conciencia “dentro de la junta”.
- Persistencia periódica del documento Yjs para no perder la sesión si el proceso reinicia.

### Réplica

- NestJS.
- Maestro en MongoDB.
- Endpoints de réplica por colección: pull, push, stream.
- Orden de publicar: valida permisos, guarda el snapshot, encola al worker.
- Identidad OIDC. El proveedor de la organización es Authentik, el mismo que el módulo de autenticación de IoKoia Space, para no crear un segundo directorio de personas. En local se puede usar un proveedor de prueba, con el mismo protocolo.

Colecciones del primer corte:

| Colección | Contenido |
|---|---|
| `spaces` | Junta, plan o hilo de ideas. Miembros. Estado. |
| `boardSnapshots` | Referencia al documento Yjs de una publicación. |
| `versions` | Markdown inmutable, autor, fecha, estado del procesamiento. |
| `attachments` | PDF, Word y multimedia de esa versión. RxDB tiene adjuntos para el binario. |

Campos de control que la réplica exige en el maestro: un orden determinista (`updatedAt` + id) y un campo de borrado (`_deleted`), para que un cliente que vuelve de estar fuera baje exactamente lo que se escribió después de su checkpoint.

### Worker

- Consume la cola.
- Pide al modelo un markdown con secciones estables: contexto, decisiones, planes, pendientes. Las secciones fijas importan porque el CLI, los agentes y las personas leen el mismo molde en cada junta.
- Pandoc genera PDF y DOCX desde ese markdown.
- Escribe la versión y los adjuntos en el maestro. La réplica avisa a los clientes.

### CLI

Binario de este motor. Comandos del primer corte:

| Comando | Efecto |
|---|---|
| `space login` | Sesión OIDC en la máquina. El token queda en el directorio de configuración del usuario. |
| `space update` | Réplica de las colecciones suscritas y escritura de markdown y adjuntos en el repo. |
| `space status` | Qué versión local hay y si la réplica está al día. |

`space update` es idempotente: la misma versión no reescribe el archivo si el contenido no cambió. Se puede correr en un gancho, en un cron o a mano. No exige la web abierta, ni que la otra persona tenga su máquina encendida, porque lee el maestro de la réplica.

El almacenamiento del CLI es el de Node. SQLite y el almacenamiento en disco de RxDB están en el paquete de pago. Para un motor que va a vivir en la máquina de cada desarrollador, ese paquete es parte de la plataforma: el rendimiento y el mismo código de colecciones en navegador, Electron si algún día aparece, y CLI, son el motivo por el que se eligió RxDB. Dexie se queda en el navegador mientras el volumen sea el de un equipo. El CLI adopta el almacenamiento de pago desde el inicio, porque ahí el dato vive meses y convive con el repo.

Cuando se migren los comandos de `iokoia space`, entran en este mismo binario (vincular repos, procedures, agentes, índice). Hasta entonces este CLI solo hace sesión, réplica y materialización.

### Paquetes compartidos del monorepo

```text
apps/web
apps/sync
apps/replicate
apps/worker
apps/cli
packages/schema     esquemas JSON de RxDB
packages/domain     space, versión, estados, nombres de archivo
```

## Varias personas a la vez

Hay dos situaciones, y cada una tiene su mecanismo.

**Dentro de la junta.** Todas las personas conectadas al mismo space editan un documento Yjs. El CRDT fusiona los trazos sin un candado. Cada una ve el cursor y el nombre de las demás por awareness. El límite práctico del primer corte es una sala por space en un nodo de sync. Para más nodos, Redis reparte las actualizaciones. El cliente no se entera del cambio.

**Fuera de la junta.** Quien no abrió la web se entera porque su CLI, o su web al abrirse, replica las versiones. La conciencia “en qué se está trabajando” fuera del tablero es el documento `spaces` y la última `version`: título, autores, fecha, estado. Eso llega por la misma réplica. No hace falta una presencia permanente en el proceso de sync si la persona no está en la sala.

Los permisos se resuelven en la réplica y en el hook del sync, no en el cliente. El cliente solo muestra lo que el servidor ya aceptó bajar.

## Estilo de diseño de la interfaz

La interfaz es de herramienta interna para desarrolladores, densa y estable. No es un sitio de presentación ni un chat.

Principios:

- La junta ocupa el lienzo. Publicar, quién está y el estado de la versión viven en un margen estrecho, siempre visible.
- Después de publicar, la lectura principal es el markdown con sus secciones, y al lado la acción de PDF y Word. El tablero queda como origen, no como la vista por defecto del documento ya cerrado.
- Tipografía y espaciado pensados para leer texto largo y listas de spaces, no para tarjetas de marketing.
- Tema claro y tema oscuro. IoKoia Space ya distingue iconos `dark` y `light` por repositorio. Este motor mantiene los dos temas para que las pantallas migradas no cambien de régimen.
- Iconos por una sola familia. Space UI usa Lucide. Aquí también, para que un módulo migrado no traiga otro juego de íconos.
- Componentes sobre React, Tailwind CSS y el mismo criterio de Base UI / shadcn que ya usa `apps/space-ui`. El motor es código nuevo. La gramática visual es esa para que la migración de pantallas sea traer comportamiento, no rediseñar cada vista.
- Presencia con nombre y space, no con un punto genérico. La persona tiene que reconocer quién publica.
- Estados explícitos de la versión: en proceso, publicada, falló. Un fallo del modelo se reintenta desde la versión. No se esconde detrás de un error de red genérico.
- El CLI es parte de la interfaz del producto. Sus textos son frases cortas, con el space, la versión y la ruta del archivo escrito.

El sistema de diseño de IoKoia (tipologías, `relations.yaml`, mapa) no se reimplementa en el primer corte. Cuando ese módulo migre, sus pantallas usan esta misma gramática.

## Robustez

| Riesgo | Cómo queda cubierto |
|---|---|
| Se cae la red en medio de la junta | Yjs sigue en los clientes conectados entre sí solo si el sync sigue en pie. Si cae el sync, el documento persistido se vuelve a cargar y los clientes reconectan. La edición que no llegó al sync se reenvía al reconectar: Yjs identifica cada cambio. |
| Se cae la red en el CLI o en la web, fuera de la pizarra | RxDB lee local. Los pushes esperan. Al volver, el checkpoint baja lo faltante y el push reintenta. |
| Dos personas publican a la vez | Son dos versiones. No hay un único markdown que se sobrescribe. |
| El modelo de IA falla o tarda | La versión queda en `falló` o `en proceso`. El worker reintenta. El tablero no depende de esa llamada. |
| Pandoc falla | El markdown ya está publicado. El adjunto PDF/Word se reintenta sin regenerar el texto. |
| El cliente estuvo semanas fuera | El pull por checkpoint recorre desde el último punto. El borrado viaja como `_deleted`, así que una versión retirada también se entera. |
| El esquema cambia al meter un módulo de IoKoia | RxDB versiona el esquema y corre migraciones en el cliente. Un módulo nuevo es una colección nueva o una versión de esquema, no una migración manual en cada máquina. |
| `space update` se corre dos veces | No reescribe el archivo si el contenido es el mismo. |
| Se reinicia el servidor de réplica | El maestro está en MongoDB. Los clientes, al reconectar, reciben `RESYNC` y cierran huecos con el checkpoint. |
| Alguien empuja un documento que el servidor no autoriza | El push devuelve el rechazo. La réplica no acepta un maestro modificado solo en el cliente. |

El paquete de pago de RxDB es una dependencia de plataforma (CLI y, si hace falta, almacenamiento rápido en el navegador). Hay que tenerlo en cuenta en el costo y en la licencia antes de cerrar el primer corte. La parte abierta (núcleo, réplica, Dexie, almacenamiento MongoDB) alcanza para desarrollar la web y el servidor.

## Escalabilidad

Escala de diseño de este producto: una organización, varias juntas concurrentes, equipos de decenas a unos pocos cientos de personas, muchos documentos acumulados en el tiempo. No es un chat público ni un lienzo para millones de conexiones anónimas. Las decisiones de abajo alcanzan esa escala y tienen un paso siguiente explícito si una cifra se sale.

| Cuello | Qué se hace ahora | Qué se hace si crece |
|---|---|---|
| Conexiones de pizarra | Un proceso de sync | Más procesos detrás de Redis. El cliente sigue en un WebSocket. |
| Lecturas de la interfaz | Locales, en RxDB. El servidor no resuelve cada click. | El maestro solo atiende réplica, no la navegación. |
| Documentos y adjuntos | MongoDB en un nodo. Adjuntos en el mismo clúster o en disco de objetos cuando el binario pese. | Réplicas de lectura de Mongo, adjuntos en almacén de objetos. El checkpoint no cambia. |
| IA y Pandoc | Un worker y una cola | Más workers sobre la misma cola. Cada trabajo es una versión. |
| Módulos futuros | Colección nueva en el mismo flujo de réplica | Se extrae un proceso solo con el criterio de la sección de microservicios. |

La réplica por lotes y por checkpoint está hecha para ponerse al día sin bajar la base entera en cada arranque. Eso es lo que permite que `space update` siga siendo barato cuando haya años de minutas y metas migradas.

## Qué queda fuera del primer corte

- Los módulos de IoKoia Space listados arriba, salvo el protocolo OIDC, que sí entra para no inventar usuarios.
- Gateway, malla de servicios, Kafka como camino del trazo.
- Edición colaborativa del markdown ya publicado. Si más adelante dos personas editan el texto, esa edición será otro documento Yjs (o el CRDT de RxDB, si el cambio cabe en operadores). No se improvisa encima del archivo publicado.
- Aplicación móvil. RxDB permite el mismo esquema en otro almacenamiento. No es trabajo de este corte.

## Orden de construcción

1. Esquemas compartidos y servidor de réplica con una colección, más un CLI que hace login y `space update` de un markdown de prueba.
2. Web que lista esas versiones desde RxDB local.
3. Sync de pizarra, presencia y publicación del snapshot.
4. Worker de markdown, PDF y Word, con estados replicados.
5. Materialización de archivos en el repo y texto de `space status`.

Ese orden prueba primero la promesa que distingue al producto (el documento llega al repositorio de otra persona) y después la pizarra. La pizarra sin réplica es una junta que no sale de la sala.

## Referencias usadas en esta decisión

- Contexto del producto: `docs/fijos/inicial/contexto-inicial.md`.
- IoKoia Space como mapa de migración: `iokdev-cli/iokoia-space/iokoia-space.project.md` y `docs/space-cli.md` de ese repositorio. Stack de interfaz existente: Next.js, React, Tailwind, Base UI, Lucide, Nest.
- RxDB: base local-first, [réplica](https://rxdb.info/replication.html) (pull, push, pullStream, checkpoint, conflictos), [almacenamientos](https://rxdb.info/rx-storage.html) (Dexie en navegador, SQLite y disco en Node de pago, MongoDB en servidor), [plugin CRDT](https://rxdb.info/crdt.html) (operadores sobre el documento, no Yjs).
- Yjs: documento compartido separado del transporte y de la persistencia. El sync de escala separa el proceso de WebSocket del worker que persiste.
