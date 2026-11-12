# Análisis de arquitectura v2 — Motor colaborativo HaruKoia

Documento de decisión para arrancar el desarrollo. Incorpora los acuerdos de la junta de Fase 2 (`docs/fijos/inicial/acuerdos-junta-fase2.md`). Lo que quedó de la propuesta anterior, sin el stack que ya no se usa, está en [arquitectura-recomendada.md](./arquitectura-recomendada.md).

Participantes de la decisión: David Quecholac, Kua Arreola Sojo.

> **Stack vigente.** Base local y réplica: **PowerSync**, con una copia central de lectura que solo alimenta el host (2026-10-19). Frontend de la v1: **React Native con Expo**, en web y en móvil (2026-11-04). La web de H1 sigue en Vite hasta que exista el diseño de esa app y se autorice construirla. Un teléfono no es host local. Registro corto: [analisis-stack-powersync-react-native.md](../../dev/dev/motor/analisis-stack-powersync-react-native.md).

## 1. Resumen de la decisión

El motor es **host-autoritativo**: cada sesión tiene un host dueño de los datos y del commit. El orquestador **no guarda nada**: registra salas y hace de relay para que los invitados alcancen al host.

Desde la revisión del 2026-10-19 existe una **réplica central**: una copia de lectura del historial de cada sala, para que quien no estuvo lo vea aunque el host esté apagado. **Solo el host la alimenta.** No es un maestro que compita con él: nadie más escribe ahí.

| Pieza | Qué es | Dónde corre |
|---|---|---|
| Orquestador | Registra salas, genera links, enruta por identificador de sala. No guarda datos y no sirve la web | Nube |
| Contenedor host | Sala Yjs, SQLite de PowerSync (SDK de Node), copia de trabajo del repo, IA, exportación | Máquina del usuario o nube (sala global) |
| Réplica central | Backend de escritura que solo acepta al host de cada sala, Postgres con la copia de lectura, PowerSync Service | Nube |
| App | Pizarra tldraw, SQLite local de PowerSync (lectura de lo replicado), presencia | Expo (React Native), web y móvil. La de H1 sigue en Vite |
| CLI | Arrancar host, estado, materializar markdown en el repo | Máquina del usuario |

Lo que cambia respecto a la propuesta anterior: **fuera MongoDB** y **fuera RxDB**; el host persiste; roles host y espectadores; markdown solo al hacer push; la pizarra tiene commits e historial; orquestador y contenedor host separados; identidad por link en la v1; base local y réplica con **PowerSync**; frontend de la v1 en **React Native**.

## 2. Qué cambia respecto a la v1

| Tema | Propuesta v1 | Decisión v2 | Por qué |
|---|---|---|---|
| Maestro de datos | MongoDB en la nube como maestro de réplica | No hay maestro central. El host es el único que escribe | Si varios replican y comitean, tres personas suben lo mismo. Con host único no hay commits duplicados |
| Quién sube | Cualquier cliente replicaba y materializaba | Solo el host comitea y hace push | Elimina el conflicto de raíz, y el rol es valor de producto |
| Markdown | Versión publicada replicada a todos | Se genera al cerrar la sesión o el bloque, no en vivo | Escribir markdown mientras se dibuja es lento. Nunca fue la intención |
| Estado de la pizarra | Snapshot al publicar | Commits con staging, historial y checkout | Lo pidió Kua: guardar es commitear una versión oficial del tablero |
| Entrega a los demás | Réplica desde el maestro en la nube | El host comitea y empuja a git; los demás bajan con git o con el CLI | Git ya es la copia que el equipo revisa |
| Procesos de servidor | Sync, réplica y worker separados | Orquestador y contenedor host. IA y exportación dentro del host. Desde el 2026-10-19, además, la réplica central | Ver sección 4 |
| Identidad | OIDC con Authentik desde el inicio | Link de invitación y nombre | Primero que funcione. Los controles de acceso vienen después |
| Salas | Una sala por space en un nodo de sync | Salas de usuario (host local) y salas globales (host en la nube) | No hace falta replicar todo con todos siempre |
| Base local y réplica (2026-10-19) | Copia local de pago y réplica contra el host por el relay | **PowerSync**: SQLite local en host y clientes; el host sube a una copia central; los demás leen de ahí, sin pasar por el relay | PowerSync autoalojado y sus SDK son gratis, funciona con el host detrás de NAT y quien no estuvo ve el historial con el host apagado |
| Frontend (2026-11-04) | React DOM con Vite | **React Native con Expo**, web y móvil, tldraw en un componente DOM | La misma app en el navegador y en el teléfono. El teléfono no es host local |

Lo que se mantiene: local-first, monorepo, motor modular en lugar de microservicios, tldraw con Yjs, Hocuspocus como servidor de la sala, y la migración posterior de IOKOIA Space hacia este motor.

## 3. Nombre del patrón y de dónde viene

El patrón es **host-autoritativo con relay en la nube**. El servidor de la nube enruta por identificador de sala y no persiste el contenido. Casos conocidos que usan la misma forma:

| Caso | Qué tomamos | Qué no tomamos |
|---|---|---|
| VS Code Live Share | El entorno real vive en la máquina de quien invita; la nube solo retransmite | Nosotros no exponemos el sistema de archivos completo |
| Jackbox | Link corto, invitados por navegador, la sala muere con el host | No hay lógica de juego en el host |
| Photon / Unity Relay | Un participante es el cliente maestro; el relay solo reenvía | No calculamos física ni estado por tick |
| `y-websocket` / Hocuspocus | Sala efímera por documento; los deltas se retransmiten a los conectados | No lo dejamos solo en memoria: el host persiste |
| RetroArch Netplay en relay | El relay existe porque el host casi nunca es alcanzable desde internet (NAT, CGNAT) | No sincronizamos entradas por cuadro |

Una diferencia importante respecto al relay puro de esos ejemplos: **la verdad no vive en el navegador del host, vive en su contenedor host**. El navegador del host es un cliente más de su propia sala.

Eso resuelve la primera desventaja clásica del modelo. Si el host tiene una máquina lenta o su pestaña se congela, la sesión no se arruina, porque el documento está en el proceso de al lado. Lo que sí sigue dependiendo del host es que su máquina esté encendida: si se cae, la sala se cierra y sobrevive el último commit. Eso se aceptó para la v1 a cambio de no programar migración de host.

La réplica central no cambia el patrón: no es un segundo host ni recibe la sala en vivo. Es una copia de lo que el host ya guardó.

## 4. Topología

```text
                    ┌──────────────────────────────┐
  Invitado  ───────►│        ORQUESTADOR           │
  (navegador)       │  web · registro de salas     │
       │            │  links · relay por roomId    │
       │            │  no guarda datos             │
       │            └──────────────┬───────────────┘
       │                           │  WebSocket saliente
       │                           │  (el host se registra)
       │            ┌──────────────▼───────────────┐
       │            │     CONTENEDOR HOST          │
       │            │  Hocuspocus (sala Yjs)       │
       │            │  SQLite de PowerSync         │
       │            │  copia de trabajo del repo   │
       │            │  IA (markdown) + Pandoc      │
       │            └──────┬───────────────┬───────┘
       │                   │               │ cola de subida
       │      git push     ▼               │ (saliente)
       │            remoto git             ▼
       │            (git pull)   ┌──────────────────────────┐
       │                         │     RÉPLICA CENTRAL      │
       └── lectura ─────────────►│  backend de escritura    │
           (sin relay)           │  Postgres · PowerSync    │
                                 └──────────────────────────┘
```

El contenedor host abre la conexión hacia el orquestador y hacia la réplica central. Así funciona detrás de NAT, sin abrir puertos ni pedir IP pública. El invitado nunca habla directo con la máquina del host: la sala en vivo le llega por el relay y el historial por la réplica central.

### Los contenedores

Se separan a nivel de código y de despliegue, con Docker Compose.

**Orquestador.** Registro de salas en memoria (identificador de sala → socket del host), generación de links y reenvío de bytes. No sirve la web y no tiene base de datos. Si se reinicia, los hosts se vuelven a registrar y los invitados reconectan.

**Contenedor host.** Imagen única, igual para los dos modos:

| Modo | Dónde corre | Quién es el host | Repo |
|---|---|---|---|
| Sala de usuario | Máquina del developer | El developer | Su propia copia de trabajo |
| Sala global | Servidor | El contenedor | Clonado por identificador, sin clon local de cada quien |

En la sala global, lo colaborado se comitea desde el servidor cuando toque. Es el caso de las pizarras de conocimiento compartido. En la sala de usuario, lo colaborado cae en la copia de trabajo de quien invitó, y el invitado no necesita la misma rama ni clonar el repo.

**Réplica central** (revisión 2026-10-19). Tres piezas: el **backend de escritura**, que recibe la cola de subida del host y solo acepta escrituras con el token de host de esa sala; **Postgres**, con la copia de lectura; y **PowerSync Service**, que lee Postgres y reparte a cada cliente lo de sus salas. PowerSync necesita además un almacén de buckets (MongoDB o Postgres).

- Es la única pieza con base de datos en la nube.
- Si se cae, la sala en vivo no se entera: el host sigue escribiendo en su SQLite y la cola sube al volver.
- Si el backend de escritura vive dentro del orquestador o como proceso propio, y cuál es el almacén de buckets, son puntos abiertos (sección 13). El criterio para decidirlo está en [por-que-no-microservicios.md](./por-que-no-microservicios.md).

## 5. Datos

### Dónde vive cada cosa

| Dato | Dónde | Tecnología |
|---|---|---|
| Tablero en vivo | Contenedor host, en memoria y persistido | Documento Yjs, binario en SQLite |
| Commits de la pizarra | Contenedor host, y su copia en la réplica central | SQLite de PowerSync en el host; Postgres en la nube |
| Markdown, PDF, Word | Copia de trabajo del repo, y su registro en el host y en la réplica central | Archivos + git; registro en SQLite y Postgres |
| Caché del invitado | Navegador | SQLite de PowerSync (lectura de lo replicado), y el log de Yjs en IndexedDB |
| Registro de salas | Orquestador | Memoria |

Qué parte de los commits sube a la copia central —solo metadatos, o también el snapshot Yjs y el JSON del tablero— es un punto abierto (sección 13). Subir el snapshot pone el tablero en la nube.

### Cómo viaja la réplica (revisión 2026-10-19)

1. El host escribe en su SQLite local, administrado por el **SDK de Node de PowerSync**. La lectura es local e inmediata.
2. Cada escritura entra a la **cola de subida** del SDK. El SDK la entrega a nuestra función `uploadData()`, que la manda al backend de escritura por una conexión **saliente**, igual que el registro de salas: funciona detrás de NAT. Sin red, la cola espera y reintenta sola.
3. El backend de escritura verifica que quien escribe es el host de esa sala, y escribe en Postgres **de forma síncrona**, como exige PowerSync.
4. PowerSync Service lee Postgres por replicación lógica y reparte por streaming a cada cliente lo de sus salas. Invitados, web y CLI **solo leen**.

**La réplica no pasa por el relay.** El relay transporta solo la sala en vivo.

**Consecuencia del modelo de PowerSync.** PowerSync es *server-authoritative*: para él la verdad es el Postgres central. Si el backend rechaza una escritura del host, esa escritura se revierte en el host en el siguiente checkpoint. Como el host es el único que escribe, eso solo pasa ante un error, y el rechazo tiene que verse (sección 10). Que solo el host escriba no lo garantiza PowerSync: lo garantiza el backend de escritura.

Costo y licencia: PowerSync Service Open Edition autoalojado (licencia FSL-1.1-ALv2, que se vuelve Apache 2.0) y los SDK de cliente (Apache 2.0) son gratis.

### Tablas de la v1

| Tabla | Contenido |
|---|---|
| `rooms` | Sala: identificador, repo, estado, modo (usuario o global) |
| `commits` | Versión del tablero: padre, mensaje, autor, participantes, fecha |
| `snapshots` | Estado Yjs y traducción a JSON de cada commit |
| `documents` | Markdown generado por commit, con su estado de proceso |
| `attachments` | PDF, Word y multimedia de ese commit |

Viven en Postgres en la réplica central y en el esquema de cliente de PowerSync. Los campos se cierran en la épica que los usa. Los adjuntos binarios no van en la base: PowerSync los maneja con su cola de archivos aparte.

### El traductor

Guardar la pizarra es guardar el estado espacio-temporal de los elementos, no texto suelto. El commit incluye dos formas del mismo tablero:

- El estado Yjs en binario, que es lo que permite volver a abrir la sesión tal cual.
- Una traducción a JSON de formas y coordenadas, que se escribe como archivo en el repo y sí se puede revisar y versionar en git.

Ese traductor es una pieza propia, con pruebas propias, porque de él depende poder bajar una pizarra a archivo y volver a subirla.

## 6. Sync en vivo, réplica y push

Es la distinción que más confusión generó en la junta, así que queda fija.

| Término | Qué es | Cuándo |
|---|---|---|
| Sync en vivo | Deltas de Yjs entre los participantes de la sala, por el relay | Todo el tiempo, mientras se dibuja |
| Réplica | El host sube lo que guardó (commits, estados) a la copia central y los demás lo leen con PowerSync | Después de cada escritura del host, haya sesión abierta o no |
| Push | Commit de la pizarra y de lo que se genera a partir de ella, y envío al remoto git | Al cerrar la sesión o un bloque, y solo por el host |

El sync en vivo no toca git ni la réplica. El push es lo que hace que el resto del equipo tenga los archivos, con la misma idea del update del CLI de IOKOIA: alguien empuja y los demás jalan. La réplica es lo que deja ver el historial y el estado del push sin bajar nada.

## 7. Versionado de la pizarra

Entra en la v1, con staging, commit e historial navegable. Ramificación queda fuera.

| Concepto | Qué significa aquí |
|---|---|
| Estado de trabajo | El documento Yjs vivo de la sala. Lo editan todos |
| Staging | Lo que los participantes marcan para entrar en la siguiente versión |
| Commit | El host guarda: queda una versión oficial con padre, autor y participantes |
| Historial | Lista de commits de esa pizarra |
| Checkout | Cargar un commit anterior como nuevo estado de trabajo |

El checkout no reescribe nada. Trae el commit elegido al estado de trabajo, y el siguiente commit cuelga de aquel. Ese encadenamiento es el que permite, más adelante, ramificar sin cambiar el modelo.

El push puede empujar la pizarra entera, no solo el markdown. El commit es la unidad: snapshot, JSON del tablero, markdown y adjuntos pertenecen a un mismo commit.

## 8. Flujo completo de una sesión

1. El developer entra a su checkout y arranca su host. El contenedor se registra en el orquestador y devuelve un link.
2. Comparte el link. Los invitados abren el navegador, entran a la sala y ven nombres y cursores.
3. Trabajan sobre el tablero. Los deltas van por el relay al host y el host los retransmite.
4. Marcan en staging lo que debe quedar en la versión.
5. El host guarda. Se crea el commit con el snapshot y el JSON del tablero en su SQLite, y la cola lo sube a la réplica central: los invitados ven el historial.
6. El host hace push. En su contenedor, la IA convierte el contenido a markdown con secciones estables, Pandoc genera PDF y Word, los archivos se escriben en la copia de trabajo y se comitean a git. El estado del push se replica igual que el commit.
7. Git push al remoto.
8. El resto del equipo baja esos archivos con git o con el CLI. No necesitan haber estado en la sesión ni tener la máquina del host encendida en ese momento. El historial y el estado del push los ven en la web, también con el host apagado.
9. Si el host cierra, la sala se cierra. El último commit ya está en el repo y en la réplica central.

## 9. Interfaz

La misma interfaz siempre, sin pantallas distintas por rol.

- Acción **volverme el host**, con un interruptor entre nube y host local. Al activarse, genera el link para invitar.
- Poder unirse a una sala con el link.
- Activar y desactivar el modo en línea.
- Varias sesiones a la vez.
- Presencia con nombre, no con un punto genérico.
- El estado del push visible: en proceso, hecho, falló.
- El estado de la réplica visible en el host: al día, o cambios pendientes de subir.
- Controles de acceso (quién entra, link privado, contraseña) quedan para después.

**React Native entra en la v1** (2026-11-04). La app es Expo, para web y para móvil, con tldraw dentro de un componente DOM. La gramática visual de IOKOIA Space (React DOM, Tailwind, Base UI) no se trae tal cual: el diseño de componentes de esa app es el siguiente documento, antes de H2. Hasta que exista y se autorice construirla, las pantallas de H1 siguen en `apps/web` con Vite. Un teléfono no puede ser host local: en el móvil se entra como espectador o a una sala global.

## 10. Errores posibles y qué hacemos

### Dependencia del host

| Riesgo | Qué pasa | Solución en la v1 |
|---|---|---|
| El host cierra la laptop en media sesión | La sala se cierra para todos | El host persiste el documento en SQLite. Al volver a arrancar, la sala se restaura en el último estado, no en el último commit. El aviso al invitado es explícito, no un error de red |
| El host tiene máquina lenta | El trazo de todos se arrastra | La autoridad está en el contenedor, no en la pestaña del host. Su navegador es un cliente más |
| El host pierde internet un momento | Se cortan los invitados | Reconexión automática. Yjs identifica cada cambio, así que al volver se reenvía lo que no llegó |
| Nadie puede commitear si el host no está | El trabajo queda sin oficializar | Aceptado. La migración de host queda fuera de la v1, y es el primer candidato a entrar si duele |

### Red y relay

| Riesgo | Solución |
|---|---|
| El host no es alcanzable desde internet (NAT, CGNAT) | El host abre la conexión saliente al orquestador. Nunca se espera una conexión entrante |
| Se reinicia el orquestador | No guarda nada. Hosts e invitados reconectan y la sala se vuelve a registrar |
| Dos hosts reclaman el mismo repo o sala | El registro del orquestador es por identificador único. El segundo recibe un error claro, como ya hace el vincular de IOKOIA Space |
| Latencia alta entre invitado y host | Yjs tolera orden distinto de llegada. Se mide y se publica el objetivo de latencia, no se esconde |

### Réplica central (revisión 2026-10-19)

| Riesgo | Solución |
|---|---|
| La réplica central se cae | La sala en vivo no depende de ella. El host sigue escribiendo en su SQLite y la cola sube al volver. Los lectores ven lo último que bajaron |
| El host trabaja sin red | Igual: la cola de subida espera. Los demás ven el historial nuevo cuando el host vuelve |
| El backend rechaza una escritura del host | PowerSync la revierte en el host en el siguiente checkpoint. Siguiendo la documentación de PowerSync, el rechazo **no** se responde con un `4xx`, que bloquea la cola: se responde con éxito y la causa queda en un registro replicado al host. La interfaz lo muestra |
| Alguien que no es el host intenta escribir | El backend lo rechaza por el token de host de la sala. Los clientes de lectura no tienen ruta de escritura |
| La misma escritura llega dos veces | El backend es idempotente: cada operación de la cola lleva un identificador incremental por cliente |
| El almacén de PowerSync crece con el historial | Compactación de buckets diaria, como recomienda PowerSync |

### Datos y versiones

| Riesgo | Solución |
|---|---|
| Un invitado editó sin red y la sala ya murió | El navegador guarda su log de Yjs en IndexedDB. Al restaurarse la sala, se fusiona. Sin eso, ese trabajo se perdería |
| El documento Yjs crece sin control en sesiones largas | Se compacta al commitear y el commit guarda el estado, no todo el historial de deltas |
| Dos personas comitean a la vez | No puede pasar: solo el host comitea |
| Conflicto de git al hacer push | El host detecta que el remoto avanzó, trae los cambios y reintenta. Si el conflicto es en un archivo generado, gana el generado del commit nuevo |
| El markdown generado sobrescribe trabajo manual en el repo | Los archivos generados viven en rutas propias y declaradas. No se mezclan con documentación escrita a mano |
| Se corre dos veces la materialización | Es idempotente: no reescribe si el contenido es idéntico |
| Cambia el formato de tldraw al actualizar | El JSON del traductor es nuestro, no el formato interno. El snapshot guarda versión de esquema y hay migración |
| Bloqueo de escritura en SQLite | Escrituras serializadas en el proceso del host. El host es un solo escritor por diseño |

### IA y exportación

| Riesgo | Solución |
|---|---|
| El modelo falla o tarda demasiado | El commit ya existe. El documento queda en estado fallido y se reintenta sin volver a dibujar nada |
| El modelo devuelve markdown sin la estructura esperada | Se valida contra las secciones fijas antes de escribir el archivo. Si no valida, se reintenta y se guarda la salida cruda para revisar |
| Pandoc falla | El markdown ya está comiteado. El PDF y el Word se reintentan sin regenerar el texto |
| El contenido de la pizarra sale de la organización al llamar al modelo | Decisión pendiente de la sección 13: qué proveedor y si hace falta un modo sin IA |

### Seguridad en la v1

| Riesgo | Solución |
|---|---|
| El link de invitación se filtra | El identificador es largo y aleatorio. El link sobrevive en el disco de ese host: al volver el proceso, abre la misma sala. No migra a otra máquina. Un cierre pedido sigue siendo definitivo para quien estaba en la página |
| Un invitado comitea o toca el repo | No tiene esa capacidad. Solo el host comitea |
| Una sala global expone un repo sensible | Mientras no haya autenticación, las salas globales se limitan a repos que el equipo acepte exponer con link |
| La réplica central expone el historial de una sala | PowerSync solo entrega datos con un JWT. El token de lectura se emite por sala. Quién lo emite y contra qué credencial es un punto abierto (sección 13). Mientras no haya autenticación, quien tenga acceso a la sala puede leer su historial |
| No hay registro de quién hizo qué | El commit guarda la lista de participantes de la sesión |

Esa fila de autenticación es deuda consciente, no un olvido. La v1 cambia control de acceso por velocidad.

## 11. Pruebas

El valor del producto es que lo dibujado llegue al repositorio de otra persona. Las pruebas se ordenan para verificar eso antes que nada.

### Unitarias

- Traductor: formas de tldraw a JSON y de vuelta, sin pérdida de coordenadas ni de orden.
- Constructor de markdown: de un snapshot fijo a las secciones esperadas, con el modelo simulado.
- Grafo de commits: padre correcto, checkout, encadenamiento después de un checkout.
- Materialización de archivos: rutas, idempotencia, no pisar documentación manual.
- Nombres y estados: de sala, de commit, de documento.
- Backend de escritura: acepta al host de la sala, rechaza a cualquier otro, idempotencia ante operaciones repetidas.

### Integración

- Réplica con PowerSync: el host escribe sin red y la cola sube al volver; un cliente sin token de host no puede escribir; el invitado lee sin pasar por el relay; apagar el host no le quita el historial a quien lee; un rechazo del backend se revierte en el host y se ve.
- Sala de Hocuspocus: entrar con link válido, rechazar link inválido, presencia con varios nombres.
- Git: commit y push contra un remoto local de prueba, incluyendo el caso de remoto adelantado.

### Varias personas a la vez

Es la prueba que no se puede saltar. Clientes Yjs sin navegador, de dos a diez, sobre la misma sala:

- Todos convergen al mismo estado después de escribir a la vez.
- La presencia refleja el número real de participantes.
- Un invitado se va y vuelve: su trabajo no se duplica ni se pierde.
- Un invitado escribe sin red, la sala se reinicia, y su trabajo se fusiona.
- El host se cae: la sala se cierra y el último commit queda intacto.

### Resistencia

Con el relay y el host en contenedores, se tumban a propósito:

- Matar el orquestador en media sesión.
- Matar el contenedor host.
- Matar la réplica central y verificar que la sala sigue y la cola sube al volver.
- Partir la red entre invitado y relay.
- Inyectar latencia y pérdida de paquetes.
- Agotar el tiempo del modelo de IA.
- Hacer fallar Pandoc.

En cada caso se verifica que no hay dato perdido sin aviso y que el reintento llega al mismo resultado.

### Rendimiento

Se mide y se fija objetivo, para poder decir si la v1 cumple:

| Qué se mide | Objetivo inicial |
|---|---|
| Latencia de un trazo hasta otro participante | por debajo de 150 ms por el relay en la misma región |
| Participantes por sala | 10 sin degradación perceptible |
| Tiempo de commit de un tablero de mil formas | por debajo de 2 segundos |
| Tiempo de un commit hasta que lo ve un lector de la réplica | se mide en la prueba de la réplica central y se fija ahí |
| Generación de markdown de una sesión típica | por debajo de 30 segundos |
| `space update` con muchas versiones acumuladas | tiempo que no crece con el historial, por el checkpoint |

### De extremo a extremo

Dos contextos de navegador en la misma sala, con el modelo simulado: dibujar, marcar staging, commitear, hacer push, y verificar el archivo en el remoto de prueba.

### Entorno de pruebas

Cuando la réplica entre: orquestador, contenedor host, réplica central (Postgres, PowerSync Service y backend de escritura), un remoto git local y un modelo simulado. Hoy el día a día es PM2 y portless. La imagen que sí corre es el `Dockerfile` de la raíz. El compose de `docker/` no coincide con el host actual y no se usa.

## 12. Orden de construcción

El trabajo se agrupa en ocho épicas que se pueden probar una por una. El desglose, con tareas, pruebas y criterios de terminado de cada una, está en [fase-1-modulos-y-tareas.md](../fases/fase-1-modulos-y-tareas.md), que es el documento que manda sobre el orden.

| # | Épica | Qué demuestra |
|---|---|---|
| H0 | Cimientos | El motor levanta y se apaga igual en las dos máquinas |
| H1 | Sala por link | Un invitado en otra red alcanza al host detrás de NAT y se ve la presencia |
| H2 | Dibujamos a la vez | Varias personas en el mismo tablero |
| H3 | La sala sobrevive | Reiniciar el host o el relay no pierde el trabajo |
| H4 | Versiones de la pizarra | Staging, commit, historial, checkout, y el tablero como archivo |
| H5 | Llega al repositorio | Publicación determinista, git y CLI; quien no estuvo recibe los archivos |
| H6 | Documento con IA | Markdown con secciones, PDF y Word |
| H7 | Sala global | Host en servidor, sin que nadie clone el repositorio |

Una versión anterior de esta sección ponía la publicación y el CLI antes de la sala, para probar primero la promesa que distingue al producto. Se cambió al orden de arriba porque **el riesgo técnico que hay que matar primero es el alcance del host detrás de NAT a través del relay** (H1): es la única pieza que no podemos copiar de una librería, y descubrir que no funciona después de construir la pizarra encima sale mucho más caro. La promesa de la entrega al repositorio sigue siendo prioritaria y por eso H5 llega antes que la IA, con una salida determinista que se verifica carácter por carácter.

Antes de H2 se escribe el **diseño de la app Expo** (lienzo, pantallas y arranque). Antes de H4 va la **prueba de la réplica central**, en [plan-pdc-stack-powersync-react-native.md](../../dev/dev/motor/plan-pdc-stack-powersync-react-native.md). Ninguna de las dos se construye desde este párrafo: cada una espera su documento y la confirmación en el chat.

## 13. Puntos abiertos

- Qué proveedor de IA se usa y si hace falta un modo sin IA para repos sensibles.
- Qué secciones exactas lleva el markdown generado.
- Qué parte del tablero entra en staging: elementos, marcos o toda la pizarra.
- Si el CLI de la v1 debe poder unirse a una sala o solo materializar y reportar.
- Cuándo entra autenticación, y si llega antes de la primera sala global con repo real.
- Si git queda dentro del alcance inicial. En la junta quedó como posible recorte, y conviene decidirlo antes del paso 5.

Abiertos por la revisión del 2026-10-19:

- **Qué sube a la réplica central**: solo metadatos (commits, autores, estados del push) o también el snapshot Yjs y el JSON del tablero.
- **Dónde vive el backend de escritura**: dentro del orquestador, lo que cambia su papel, o como proceso propio.
- **Quién emite el token de lectura** de PowerSync, contra qué credencial (por ejemplo el token de invitación) y con qué alcance.
- **Almacén de buckets** de PowerSync: MongoDB o Postgres. Referencia: Space usa Postgres `powersync_storage` en el mismo host ([referencia Space](../referencia-space-powersync-sqlite-secrets.md)).
- Si `space update` sigue bajando de git o lee de la réplica central.
- Si las reglas del contrato fijadas en H0 (orden por `actualizadoEn`, borrado lógico, migración al leer) siguen igual o se ajustan al modelo de PowerSync. Referencia: Space fija client schema / views y prohíbe migrar el espejo ([referencia Space §5](../referencia-space-powersync-sqlite-secrets.md#5-evolución-de-esquema-en-el-device-146--respuesta-a-s8)).
- **Cómo se arranca la app Expo** con PM2 y portless, y cuál es su diseño de pantallas y de lienzo. React Native ya entra; esto es el documento siguiente, antes de H2. Para SQLite RN y secrets: [referencia Space](../referencia-space-powersync-sqlite-secrets.md).

## 14. Fuera del alcance de la v1

- Migración de host.
- Ramificación del historial de la pizarra.
- Control de acceso, link privado, contraseña.
- Un maestro central que escriba. La réplica central solo la alimenta el host.
- Markdown en tiempo real.
- Los módulos de IOKOIA Space.
- El teléfono como host local. En el móvil se entra como espectador o a una sala global.

## 15. Referencias

- Acuerdos de la junta: `docs/fijos/inicial/acuerdos-junta-fase2.md`.
- Lo que sigue de la propuesta anterior, sin el stack retirado: [arquitectura-recomendada.md](./arquitectura-recomendada.md).
- Criterio de no partir en microservicios: [por-que-no-microservicios.md](./por-que-no-microservicios.md).
- Contexto del producto: [../inicial/contexto-inicial.md](../inicial/contexto-inicial.md).
- Análisis de la revisión del stack: [analisis-stack-powersync-react-native.md](../../dev/dev/motor/analisis-stack-powersync-react-native.md).
- Lo cableado en IOKOIA Space (SQLite, secrets, PowerSync): [referencia-space-powersync-sqlite-secrets.md](../referencia-space-powersync-sqlite-secrets.md). Repo: `/home/davesq/Documents/IoKoia/space/`.
- PowerSync: [arquitectura](https://docs.powersync.com/architecture/architecture-overview), [cliente y cola de subida](https://docs.powersync.com/architecture/client-architecture), [escrituras del cliente](https://docs.powersync.com/handling-writes/writing-client-changes), [SDK de Node](https://docs.powersync.com/client-sdks/reference/node), [autoalojado](https://docs.powersync.com/self-hosting/getting-started), [cambios de esquema](https://docs.powersync.com/maintenance-ops/implementing-schema-changes), [CRDT con Yjs](https://docs.powersync.com/client-sdks/advanced/crdts).
- Expo: [componentes DOM](https://docs.expo.dev/guides/dom-components/), [monorepos](https://docs.expo.dev/guides/monorepos/).
- Yjs y Hocuspocus para la sala en vivo. Patrón de relay host-autoritativo: Live Share, Jackbox, Photon, `y-websocket`.
