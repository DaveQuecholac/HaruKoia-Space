# Análisis de arquitectura v2 — Motor colaborativo HaruKoia

Documento de decisión para arrancar el desarrollo. Incorpora los acuerdos de la junta de Fase 2 (`docs/fijos/inicial/acuerdos-junta-fase2.md`) y sustituye, en los puntos que cambian, a [arquitectura-recomendada.md](./arquitectura-recomendada.md).

Participantes de la decisión: David Quecholac, Kua Arreola Sojo.

## 1. Resumen de la decisión

El motor es **host-autoritativo**: cada sesión tiene un host dueño de los datos y del commit. El servidor en la nube **no guarda el tablero**: registra salas y hace de relay para que los invitados alcancen al host. No hay maestro central de documentos.

| Pieza | Qué es | Dónde corre |
|---|---|---|
| Orquestador | Sirve la web, registra salas, genera links, enruta por `roomId` | Nube |
| Contenedor host | Sala Yjs, RxDB + SQLite, copia de trabajo del repo, IA, exportación | Máquina del usuario o nube (sala global) |
| Web | Pizarra tldraw, RxDB local (Dexie), presencia | Navegador |
| CLI | Arrancar host, estado, materializar markdown en el repo | Máquina del usuario |

Lo que cambia respecto a la propuesta anterior: **fuera MongoDB**, el host persiste; roles host y espectadores; markdown solo al hacer push; la pizarra tiene commits e historial; dos contenedores separados; identidad por link en la v1.

## 2. Qué cambia respecto a la v1

| Tema | Propuesta v1 | Decisión v2 | Por qué |
|---|---|---|---|
| Maestro de datos | MongoDB en la nube como maestro de réplica | No hay maestro central. El host persiste en RxDB + SQLite | Si varios replican y comitean, tres personas suben lo mismo. Con host único no hay commits duplicados |
| Quién sube | Cualquier cliente replicaba y materializaba | Solo el host comitea y hace push | Elimina el conflicto de raíz, y el rol es valor de producto |
| Markdown | Versión publicada replicada a todos | Se genera al cerrar la sesión o el bloque, no en vivo | Escribir markdown mientras se dibuja es lento. Nunca fue la intención |
| Estado de la pizarra | Snapshot al publicar | Commits con staging, historial y checkout | Lo pidió Kua: guardar es commitear una versión oficial del tablero |
| Entrega a los demás | Réplica desde el maestro en la nube | El host comitea y empuja a git; los demás bajan con git o con el CLI | Git ya es la copia que el equipo revisa |
| Procesos de servidor | Sync, réplica y worker separados | Orquestador y contenedor host. IA y exportación dentro del host | Sin maestro central no hace falta un proceso de réplica aparte |
| Identidad | OIDC con Authentik desde el inicio | Link de invitación y nombre | Primero que funcione. Los controles de acceso vienen después |
| Salas | Una sala por space en un nodo de sync | Salas de usuario (host local) y salas globales (host en la nube) | No hace falta replicar todo con todos siempre |

Lo que se mantiene: local-first, monorepo, motor modular en lugar de microservicios, tldraw con Yjs, Hocuspocus como servidor de la sala, RxDB como base local, y la migración posterior de IOKOIA Space hacia este motor.

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

## 4. Topología

```text
                    ┌──────────────────────────────┐
  Invitado  ───────►│        ORQUESTADOR           │
  (navegador)       │  web · registro de salas     │
                    │  links · relay por roomId    │
                    │  no guarda el tablero        │
                    └──────────────┬───────────────┘
                                   │  WebSocket saliente
                                   │  (el host se registra)
                    ┌──────────────▼───────────────┐
                    │     CONTENEDOR HOST          │
                    │  Hocuspocus (sala Yjs)       │
                    │  RxDB + SQLite               │
                    │  copia de trabajo del repo   │
                    │  IA (markdown) + Pandoc      │
                    └──────────────┬───────────────┘
                                   │
                     git push      ▼
                            remoto git  ───►  el resto del equipo
                                              (git pull / space update)
```

El contenedor host abre la conexión hacia el orquestador. Así funciona detrás de NAT, sin abrir puertos ni pedir IP pública. El invitado nunca habla directo con la máquina del host.

### Los dos contenedores

Se separan a nivel de código y de despliegue, con Docker Compose.

**Orquestador.** Registro de salas en memoria (`roomId → socket del host`), generación de links, la web, y el reenvío de bytes. No tiene base de datos del tablero. Si se reinicia, los hosts se vuelven a registrar y los invitados reconectan.

**Contenedor host.** Imagen única, igual para los dos modos:

| Modo | Dónde corre | Quién es el host | Repo |
|---|---|---|---|
| Sala de usuario | Máquina del developer | El developer | Su propia copia de trabajo |
| Sala global | Servidor | El contenedor | Clonado por identificador, sin clon local de cada quien |

En la sala global, lo colaborado se comitea desde el servidor cuando toque. Es el caso de las pizarras de conocimiento compartido. En la sala de usuario, lo colaborado cae en la copia de trabajo de quien invitó, y el invitado no necesita la misma rama ni clonar el repo.

## 5. Datos

### Dónde vive cada cosa

| Dato | Dónde | Tecnología |
|---|---|---|
| Tablero en vivo | Contenedor host, en memoria y persistido | Documento Yjs, binario en SQLite |
| Commits de la pizarra | Contenedor host | RxDB con almacenamiento SQLite |
| Markdown, PDF, Word | Copia de trabajo del repo, y como registro en RxDB | Archivos + git |
| Caché del invitado | Navegador | RxDB con Dexie, y el log de Yjs en IndexedDB |
| Registro de salas | Orquestador | Memoria |

RxDB sigue siendo la base, pero su maestro de réplica ahora es el contenedor host, no la nube. El host expone las tres operaciones que RxDB necesita: traer cambios desde un checkpoint, recibir escrituras y emitir el stream de novedades. El navegador del invitado replica contra el host a través del relay.

El almacenamiento SQLite de RxDB está en el paquete de pago. Es dependencia de plataforma, porque el host es justamente donde el dato vive meses. En el navegador basta Dexie.

### Colecciones de la v1

| Colección | Contenido |
|---|---|
| `rooms` | Sala: identificador, repo, estado, modo (usuario o global) |
| `commits` | Versión del tablero: padre, mensaje, autor, participantes, fecha |
| `snapshots` | Estado Yjs y traducción a JSON de cada commit |
| `documents` | Markdown generado por commit, con su estado de proceso |
| `attachments` | PDF, Word y multimedia de ese commit |

### El traductor

Guardar la pizarra es guardar el estado espacio-temporal de los elementos, no texto suelto. El commit incluye dos formas del mismo tablero:

- El estado Yjs en binario, que es lo que permite volver a abrir la sesión tal cual.
- Una traducción a JSON de formas y coordenadas, que se escribe como archivo en el repo y sí se puede revisar y versionar en git.

Ese traductor es una pieza propia, con pruebas propias, porque de él depende poder bajar una pizarra a archivo y volver a subirla.

## 6. Los dos significados de push

Es la distinción que más confusión generó en la junta, así que queda fija.

| Término | Qué es | Cuándo |
|---|---|---|
| Sync en vivo | Deltas de Yjs entre los participantes de la sala | Todo el tiempo, mientras se dibuja |
| Push | Commit de la pizarra y de lo que se genera a partir de ella, y envío al remoto git | Al cerrar la sesión o un bloque, y solo por el host |

El sync en vivo no toca git. El push es lo que hace que el resto del equipo se entere, con la misma idea del update del CLI de IOKOIA: alguien empuja y los demás jalan.

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
5. El host guarda. Se crea el commit con el snapshot y el JSON del tablero.
6. El host hace push. En su contenedor, la IA convierte el contenido a markdown con secciones estables, Pandoc genera PDF y Word, los archivos se escriben en la copia de trabajo y se comitean a git.
7. Git push al remoto.
8. El resto del equipo baja esos archivos con git o con el CLI. No necesitan haber estado en la sesión ni tener la máquina del host encendida en ese momento.
9. Si el host cierra, la sala se cierra. El último commit ya está en el repo.

## 9. Interfaz

La misma interfaz siempre, sin pantallas distintas por rol.

- Acción **volverme el host**, con un interruptor entre nube y host local. Al activarse, genera el link para invitar.
- Poder unirse a una sala con el link.
- Activar y desactivar el modo en línea.
- Varias sesiones a la vez.
- Presencia con nombre, no con un punto genérico.
- El estado del push visible: en proceso, hecho, falló.
- Controles de acceso (quién entra, link privado, contraseña) quedan para después.

El lenguaje visual se mantiene alineado con IOKOIA Space (React, Tailwind, Lucide, tema claro y oscuro) para que las pantallas migradas no cambien de régimen.

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
| Se reinicia el orquestador | No guarda tablero. Hosts e invitados reconectan y la sala se vuelve a registrar |
| Dos hosts reclaman el mismo repo o sala | El registro del orquestador es por identificador único. El segundo recibe un error claro, como ya hace el vincular de IOKOIA Space |
| Latencia alta entre invitado y host | Yjs tolera orden distinto de llegada. Se mide y se publica el objetivo de latencia, no se esconde |

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
| El link de invitación se filtra | El identificador es largo y aleatorio, la sala muere con el host y el link no sobrevive a la sesión |
| Un invitado comitea o toca el repo | No tiene esa capacidad. Solo el host comitea |
| Una sala global expone un repo sensible | Mientras no haya autenticación, las salas globales se limitan a repos que el equipo acepte exponer con link |
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

### Integración

- Réplica de RxDB contra el host: traer desde checkpoint, empujar, stream, y el reenganche cuando se pierden eventos.
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
| Generación de markdown de una sesión típica | por debajo de 30 segundos |
| `space update` con muchas versiones acumuladas | tiempo que no crece con el historial, por el checkpoint |

### De extremo a extremo

Dos contextos de navegador en la misma sala, con el modelo simulado: dibujar, marcar staging, commitear, hacer push, y verificar el archivo en el remoto de prueba.

### Entorno de pruebas

Docker Compose con orquestador, contenedor host, un remoto git local y un modelo simulado. El mismo Compose que se usa para desarrollar.

## 12. Orden de construcción

1. Contenedor host con RxDB y SQLite, y un CLI que materialice un markdown de prueba en el repo y lo comitee.
2. Orquestador con registro de salas, link y relay. Un invitado alcanza al host detrás de NAT.
3. Sala de pizarra con tldraw, Yjs y presencia. Varias personas dibujando.
4. Staging, commit, historial y checkout. Traductor a JSON en el repo.
5. Push: IA a markdown, Pandoc a PDF y Word, commit y push a git.
6. Sala global con el mismo contenedor host en servidor y repo clonado por identificador.

El paso 1 prueba primero la promesa que distingue al producto. Una pizarra que no sale de la sala es una junta que no sirvió de nada.

## 13. Puntos abiertos

- Qué proveedor de IA se usa y si hace falta un modo sin IA para repos sensibles.
- Qué secciones exactas lleva el markdown generado.
- Qué parte del tablero entra en staging: elementos, marcos o toda la pizarra.
- Si el CLI de la v1 debe poder unirse a una sala o solo materializar y reportar.
- Cuándo entra autenticación, y si llega antes de la primera sala global con repo real.
- Si git queda dentro del alcance inicial. En la junta quedó como posible recorte, y conviene decidirlo antes del paso 5.

## 14. Fuera del alcance de la v1

- Migración de host.
- Ramificación del historial de la pizarra.
- Control de acceso, link privado, contraseña.
- Maestro central en la nube.
- Markdown en tiempo real.
- Los módulos de IOKOIA Space.
- Aplicación móvil.

## 15. Referencias

- Acuerdos de la junta: `docs/fijos/inicial/acuerdos-junta-fase2.md`.
- Arquitectura previa, vigente en lo que no cambió: [arquitectura-recomendada.md](./arquitectura-recomendada.md).
- Criterio de no partir en microservicios: [por-que-no-microservicios.md](./por-que-no-microservicios.md).
- Contexto del producto: [../inicial/contexto-inicial.md](../inicial/contexto-inicial.md).
- RxDB: [réplica](https://rxdb.info/replication.html), [almacenamientos](https://rxdb.info/rx-storage.html), [plugin CRDT](https://rxdb.info/crdt.html).
- Yjs y Hocuspocus para la sala en vivo. Patrón de relay host-autoritativo: Live Share, Jackbox, Photon, `y-websocket`.
