# Fase 1 — Épicas, módulos y tareas

Qué se construye en la fase 1, agrupado en **ocho mini-épicas** que se pueden probar una por una, y el catálogo de los **veinte módulos** que las componen.

Base: [análisis de arquitectura v2](../arquitectura/analisis-arquitectura-v2.md). Las decisiones cerradas de ahí no se reabren aquí.

Fase 1 es **el motor funcionando**: una sala con varias personas dibujando, un commit de la pizarra, y el markdown llegando al repositorio de alguien que no estuvo en la sesión. Los módulos de IOKOIA Space **no** son fase 1.

## Cómo leer este documento

| Unidad | Qué es | Para qué sirve |
|--------|--------|----------------|
| **Épica (H0–H7)** | Una funcionalidad que alguien puede **usar y probar** | Es la unidad de trabajo, de rama y de demostración |
| **Módulo (M1–M20)** | Una pieza del sistema con dueño claro | Es la unidad de código, para saber dónde vive cada cosa |

Un módulo aparece en varias épicas: el relay (M5) nace en H1 y se endurece en H3. Las **tareas se numeran por épica**, no por módulo, porque el trabajo se reparte por funcionalidad.

> **Orden de construcción.** Este documento manda sobre el orden. La sección 12 del análisis v2 propone otro (publicación antes que sala) y quedó superada por la decisión de empezar por la sala, donde está el riesgo técnico real.

---

## 1. Las ocho épicas

| # | Historia | Se prueba con | Riesgo que mata |
|---|----------|---------------|-----------------|
| **H0** | Levanto el motor | `pnpm dev` y las pruebas corriendo en las dos máquinas | Que cada quien trabaje en un entorno distinto |
| **H1** | Entro por un link desde otra red y veo quién está | Dos máquinas en redes distintas, lista de participantes viva | **Que el host detrás de NAT no sea alcanzable** |
| **H2** | Dibujamos los dos a la vez | Dos personas trazando, con cursores y nombres | Integración del lienzo con la sala |
| **H3** | Cierro la laptop y la sala vuelve | Reiniciar el host y matar el relay sin perder el tablero | Pérdida de trabajo; es lo que hace inusable el producto |
| **H4** | Guardo una versión y vuelvo a ella | Staging, commit, historial, checkout; tablero como archivo | El versionado de pizarra es lo que estamos inventando |
| **H5** | Lo guardado llega al repositorio de quien no estuvo | `space update` en otra máquina trae el archivo | Que la promesa del producto no se cumpla |
| **H6** | La IA convierte la pizarra en documento | Markdown con secciones, PDF y Word | Calidad de la salida del modelo |
| **H7** | La sala vive en el servidor | Sala global sin que nadie clone el repositorio | Operación del host fuera de la máquina del developer |

### Por qué ese orden

**H1 antes que la pizarra.** El riesgo mayor no es dibujar juntos —eso lo resuelven las librerías— sino que un invitado en otra red alcance al host a través del relay. Si falla en la semana dos se replantea barato; en la semana ocho ya hay una pizarra construida encima.

**H3 donde está, no al final.** La resistencia a caídas suele dejarse para el cierre y es lo que mata estos proyectos: una pizarra que pierde trabajo cuando el host suspende la laptop no es usable, y arreglarlo después obliga a rehacer la sala.

**H4 antes de publicar.** Staging, commit y checkout sobre un tablero no son un patrón que podamos copiar de ningún lado. Hay que usarlo un par de semanas antes de construir la publicación encima.

**H5 publica sin IA.** La primera publicación que llega al repositorio es un markdown **determinista** —versión, participantes, fecha, notas del tablero— verificable carácter por carácter. Así se depura el transporte sin depurar al mismo tiempo una salida que cambia en cada corrida, y no depende del proveedor de IA, que es una decisión abierta. No es un simulacro que se tire: queda como una variante más del mecanismo de publicación de M11, al lado de la variante con IA.

---

## 2. Matriz de épicas y módulos

| Módulo | H0 | H1 | H2 | H3 | H4 | H5 | H6 | H7 |
|--------|----|----|----|----|----|----|----|----|
| M1 Arranque | ● | | | | | | | |
| M2 Esquemas y dominio | ◐ | ◐ | | | ◐ | ● | ◐ | |
| M3 Base local y réplica | | | | | ◐ | ● | | |
| M4 Registro de salas | | ● | | ◐ | | | | ◐ |
| M5 Relay | | ● | | ● | | | | ◐ |
| M6 Sala en vivo | | ◐ | ◐ | ● | | | | |
| M7 Presencia | | ● | ◐ | | | | | |
| M8 Pizarra | | | ● | ◐ | | | | |
| M9 Traductor | | | | | ● | | | |
| M10 Staging y commits | | | | | ● | | | |
| M11 Push | | | | | | ● | ◐ | |
| M12 Markdown con IA | | | | | | | ● | |
| M13 Exportación | | | | | | | ● | |
| M14 Git | | | | | | ● | | ◐ |
| M15 CLI | | | | | | ● | | |
| M16 Identidad y roles | | ◐ | | | ◐ | | | ● |
| M17 Sala global | | | | | | | | ● |
| M18 Interfaz y sesiones | | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |
| M19 Pruebas | ● | ● | ● | ● | ● | ● | ● | ● |
| M20 Diagnóstico | ◐ | ● | | ● | | ◐ | ◐ | |

● entra de lleno · ◐ entra en parte

M19 y M20 no son una épica aparte: cada épica termina con sus pruebas y sus estados visibles, o no termina.

---

## 3. H0 — Levanto el motor

> **Historia.** Clono el repositorio, corro un comando y tengo el motor arriba. Lo apago con otro comando.

**Alcance.** Monorepo, arranque con PM2 y portless, contenedores, typecheck, andamio de pruebas y las reglas del contrato de datos.

**No entra.** Los campos de cada colección: se cierran en la épica que los usa. Diseñar el esquema de documentos publicados antes de H5 es la forma más cara de equivocarse.

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H0-T1 | `pnpm install` limpio y `pnpm dev` arrancando las tres apps con logs | M1 |
| H0-T2 | `dev:stop`, `dev:status` y `dev:restart` verificados en las dos máquinas | M1 |
| H0-T3 | Git inicializado, rama de trabajo y su carpeta en `docs/dev/` | M1 |
| H0-T4 | `pnpm docker:up` con orquestador y host respondiendo `/health` | M1 |
| H0-T5 | Reglas del contrato: identificadores, versionado de esquema, orden de réplica, borrado lógico | M2 |
| H0-T6 | Andamio de pruebas: runner elegido, `pnpm test` corriendo de verdad | M19 |
| H0-T7 | Formato de log común con identificador de sala | M20 |

**Pruebas.** Unitarias del generador de identificadores y del versionado de esquema. El resto es verificación manual del arranque en las dos máquinas.

**Definition of done.**
1. Las dos personas levantan y apagan el motor sin ayuda.
2. `pnpm typecheck` y `pnpm test` pasan, y `test` ejecuta al menos una prueba real.
3. Los dos contenedores arrancan y responden.
4. Las reglas del contrato están escritas y las dos personas las leyeron.

---

## 4. H1 — Entro por un link desde otra red y veo quién está

> **Historia.** Me vuelvo host, comparto un link, y alguien en otra red entra y aparecemos los dos en la lista de participantes.

**Alcance.** Registro de salas, relay, sala en vivo mínima, presencia, roles mínimos y las pantallas de entrada.

**No entra.** Lienzo (H2), persistencia de la sala (H3), commits (H4), autenticación.

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H1-T1 | Contrato del protocolo: registro, apertura de conexión de invitado, cierre, error | M2 |
| H1-T2 | Registro de salas en memoria: alta, baja, rechazo de duplicado | M4 |
| H1-T3 | Identificador de sala y token de invitación; generación del link | M4, M16 |
| H1-T4 | Conexión saliente del host al orquestador y su registro | M5 |
| H1-T5 | Enrutamiento del invitado hasta el host por identificador de sala | M5 |
| H1-T6 | Reconexión con espera creciente, de host y de invitado | M5 |
| H1-T7 | Sala en vivo mínima en el host, con el documento compartido | M6 |
| H1-T8 | Presencia: nombre del participante y lista viva | M7 |
| H1-T9 | Rol host o espectador, resuelto en el servidor | M16 |
| H1-T10 | Pantallas: nombre, volverme host, copiar link, unirme | M18 |
| H1-T11 | Aviso explícito de sala cerrada o link inválido, no un error de red | M5, M20 |
| H1-T12 | Pruebas de integración y de varios participantes sin navegador | M19 |

**Pruebas.**
- Unitarias: registro de salas, tokens, espera creciente.
- Integración: host, orquestador y clientes sin navegador en la misma sala.
- Varios participantes: de 2 a 10 entran y salen; la lista refleja el número real.
- Resistencia: matar el orquestador y el host en media sesión.
- Manual: dos máquinas en **redes distintas**.

**Definition of done.**
1. Alguien en otra red entra por el link sin configurar nada.
2. Los participantes se ven con su nombre y desaparecen al salir.
3. Matar el orquestador y levantarlo deja la sala funcionando sin recargar.
4. Al apagar el host, el invitado ve "sala cerrada", no un error genérico.
5. Un espectador no puede ejecutar acciones de host ni con la petición hecha a mano.
6. La prueba de varios participantes corre en la máquina de cualquiera de los dos.

**Decisiones que la bloquean.** Librería del servidor WebSocket, forma del relay, y si el token del link se separa del identificador de sala. Ver el análisis de la rama `dev/motor`.

---

## 5. H2 — Dibujamos los dos a la vez

> **Historia.** Dibujo y mi trazo aparece en la pantalla de la otra persona, con su cursor moviéndose en el mío.

**Alcance.** Lienzo conectado a la sala, cursores y selección ajena, comportamiento sin red.

**No entra.** Guardar versiones (H4), exportar (H6).

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H2-T1 | Lienzo montado en la web | M8 |
| H2-T2 | Lienzo conectado al documento de la sala | M8 |
| H2-T3 | Dos personas dibujando sin candados ni pisadas | M8 |
| H2-T4 | Cursores y selección de los demás | M7 |
| H2-T5 | Sin red se sigue dibujando y al volver se fusiona | M8 |
| H2-T6 | Medición de la latencia de un trazo | M19 |

**Pruebas.** Convergencia con escrituras simultáneas; un invitado se va y vuelve sin duplicar ni perder su trabajo; latencia medida contra el objetivo.

**Definition of done.**
1. El trazo de una persona aparece en la otra pantalla por debajo del objetivo de latencia.
2. Con diez clientes el tablero converge al mismo estado.
3. Quien se queda sin red sigue dibujando y al volver no pierde nada.

---

## 6. H3 — Cierro la laptop y la sala vuelve

> **Historia.** Mi máquina se suspende o el relay se cae, y cuando vuelvo la sala sigue siendo la misma.

**Alcance.** Persistencia del documento de la sesión, restauración, reconexión y estados visibles.

**No entra.** Migración de host: si el host no vuelve, la sala no revive en otra máquina. Está fuera de la v1.

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H3-T1 | Persistencia del documento de la sesión en disco | M6 |
| H3-T2 | Restauración de la sala en el último estado al rearrancar | M6 |
| H3-T3 | Compactación del documento | M6 |
| H3-T4 | Reconexión de invitados al volver el host, sin recargar | M5 |
| H3-T5 | El invitado que trabajó sin red se fusiona al restaurarse la sala | M6, M8 |
| H3-T6 | Estados visibles: en línea, reconectando, sala cerrada | M18, M20 |
| H3-T7 | Pruebas de resistencia: matar procesos, partir la red, inyectar latencia | M19 |

**Definition of done.**
1. Reiniciar el contenedor host devuelve la sala en el último estado, no en el último guardado.
2. Matar el relay no pierde trazos: al reconectar, converge.
3. Ningún dato se pierde **sin aviso**: si algo se perdió, la interfaz lo dice.

---

## 7. H4 — Guardo una versión y vuelvo a ella

> **Historia.** Marco lo que vale, guardo una versión con su mensaje, veo el historial y puedo volver a una versión anterior.

**Alcance.** Traductor a JSON, staging, commits con padre y participantes, historial y checkout.

**No entra.** Ramificación. Publicación al repositorio (H5).

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H4-T1 | Del tablero a JSON: formas, coordenadas, orden | M9 |
| H4-T2 | De JSON al tablero, sin pérdida | M9 |
| H4-T3 | Versión de formato propia, independiente del formato de la librería | M9 |
| H4-T4 | Área de staging y marcado por los participantes | M10 |
| H4-T5 | Commit: snapshot, JSON, autor, participantes, padre | M10 |
| H4-T6 | Historial navegable | M10, M18 |
| H4-T7 | Checkout de un commit como nuevo estado de trabajo | M10 |
| H4-T8 | Solo el host comitea, validado en el servidor | M16 |
| H4-T9 | Historial replicado a los invitados | M3 |
| H4-T10 | Pruebas de ida y vuelta del traductor y del grafo de commits | M19 |

**Definition of done.**
1. Se guarda, se ve el historial, se vuelve a una versión y se sigue trabajando desde ahí.
2. Un tablero exportado y reimportado es idéntico.
3. El archivo JSON se entiende en un diff de git.
4. El commit después de un checkout cuelga del commit correcto.

**Decisión que la bloquea.** Qué parte del tablero entra en staging: elementos, marcos o toda la pizarra.

---

## 8. H5 — Lo guardado llega al repositorio de quien no estuvo

> **Historia.** Guardo una versión, hago push, y alguien que no estuvo en la junta corre un comando y tiene los archivos en su repositorio.

**Alcance.** Tubería de publicación, salida determinista sin IA, escritura en la copia de trabajo, commit y push a git, y el CLI.

**No entra.** La IA (H6) y los adjuntos PDF y Word (H6).

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H5-T1 | Colecciones de documentos y adjuntos en el contrato | M2 |
| H5-T2 | Base local del host con almacenamiento en disco | M3 |
| H5-T3 | Los tres puntos de réplica del host, con reenganche desde el checkpoint | M3 |
| H5-T4 | Cola de trabajos de publicación en el host | M11 |
| H5-T5 | Mecanismo genérico de publicación con variantes de formato | M11 |
| H5-T6 | Variante determinista: markdown sin modelo, a partir del commit | M11 |
| H5-T7 | Estados replicados: en proceso, publicado, fallido, y reintento | M11, M18 |
| H5-T8 | Escritura en rutas propias y declaradas, sin tocar documentación manual | M14 |
| H5-T9 | Commit y push a git, con el caso de remoto adelantado | M14 |
| H5-T10 | `space host`, `space status`, `space update` | M15 |
| H5-T11 | Idempotencia de la materialización | M15 |
| H5-T12 | Prueba de extremo a extremo contra un remoto git local | M19 |

**Definition of done.**
1. Alguien que no estuvo corre un comando y tiene el markdown y el tablero en su repositorio.
2. Correr el comando dos veces no cambia nada.
3. Un remoto adelantado se resuelve con reintento, sin intervención manual.
4. Un fallo de publicación se ve, dice la causa y se puede reintentar sin volver a dibujar.

**Decisiones que la bloquean.** Si git entra en el alcance inicial —se necesita **antes de H4**, porque cambia la forma de esta épica— y la licencia del almacenamiento en disco de la base local.

---

## 9. H6 — La IA convierte la pizarra en documento

> **Historia.** Hago push y lo que dibujamos llega como un documento con contexto, decisiones, planes y pendientes, más su PDF y su Word.

**Alcance.** Variante con modelo de la tubería de publicación, validación de secciones, y exportación.

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H6-T1 | Entrada del modelo desde el snapshot y el JSON del tablero | M12 |
| H6-T2 | Secciones fijas y su validación antes de escribir el archivo | M12 |
| H6-T3 | Reintento y guardado de la salida cruda cuando no valida | M12 |
| H6-T4 | Modelo simulado en las pruebas, sin ramas de simulación en el camino real | M12, M19 |
| H6-T5 | PDF y Word desde el markdown publicado | M13 |
| H6-T6 | Adjuntos asociados al commit y reintento sin regenerar el texto | M13 |

**Definition of done.**
1. Un commit produce markdown con las secciones acordadas, PDF y Word.
2. Si el modelo devuelve algo que no valida, no se escribe el archivo y queda la salida cruda para revisar.
3. Un fallo de exportación no obliga a volver a pasar por el modelo.

**Decisiones que la bloquean.** Qué proveedor de IA, si hace falta un modo sin modelo para repositorios sensibles, y qué secciones exactas lleva el markdown.

---

## 10. H7 — La sala vive en el servidor

> **Historia.** Abro una pizarra de equipo que no vive en la máquina de nadie, trabajamos, y el commit llega al repositorio.

**Alcance.** El mismo contenedor host en un servidor, con el repositorio clonado por identificador.

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H7-T1 | Arranque del host en modo global y su registro | M17 |
| H7-T2 | Clonado del repositorio por identificador dentro del contenedor | M17 |
| H7-T3 | Commit y push desde el servidor | M17, M14 |
| H7-T4 | Interruptor nube o local al volverse host | M18 |
| H7-T5 | Roles completos y validación en el servidor | M16 |

**Definition of done.**
1. Una sala global comitea sin que nadie tenga el repositorio en su máquina.
2. La misma imagen de contenedor sirve para los dos modos.

**Deuda consciente.** Sin autenticación, las salas globales se limitan a repositorios que el equipo acepte exponer con link.

---

## 11. Catálogo de módulos

Qué es cada pieza y dónde vive. Las tareas están en las épicas.

| Módulo | Qué hace | Depende de | Épicas |
|--------|----------|-----------|--------|
| **M1** Arranque | Monorepo, PM2 y portless, contenedores, typecheck | — | H0 |
| **M2** Esquemas y dominio | Contrato de datos: sala, commit, snapshot, documento, adjunto; versiones y migraciones | M1 | H0, H1, H4, H5, H6 |
| **M3** Base local y réplica | Base local en navegador y host; traer desde checkpoint, empujar, stream, reenganche | M2 | H4, H5 |
| **M4** Registro de salas | `identificador de sala → conexión del host`, links, resolución. No persiste | M1 | H1, H3, H7 |
| **M5** Relay | Mover bytes entre invitados y host. Conexión saliente del host | M4 | H1, H3, H7 |
| **M6** Sala en vivo | Documento compartido de la sesión en el host, con persistencia | M5, M2 | H1, H2, H3 |
| **M7** Presencia | Quién está y en qué: nombre, cursor, foco | M6 | H1, H2 |
| **M8** Pizarra | Lienzo: formas, selección, cámara, conectado a la sala | M6, M7 | H2, H3 |
| **M9** Traductor | Tablero a JSON portable y de vuelta. Es el archivo que git revisa | M8, M2 | H4 |
| **M10** Staging y commits | Staging, commit con padre y participantes, historial, checkout | M6, M9, M16 | H4 |
| **M11** Push | Tubería de publicación: cola, variantes de formato, estados | M10, M3 | H5, H6 |
| **M12** Markdown con IA | Variante con modelo, con secciones fijas y validación | M11, M9 | H6 |
| **M13** Exportación | PDF y Word desde el markdown, y sus adjuntos | M12, M11 | H6 |
| **M14** Git | Copia de trabajo, escritura de generados, commit y push | M11, M16 | H5, H7 |
| **M15** CLI `space` | Arrancar host, estado, materializar en el repositorio | M3, M2, M14 | H5 |
| **M16** Identidad y roles | Link y nombre; host y espectador; validación en el servidor | M4, M6 | H1, H4, H7 |
| **M17** Sala global | Host en servidor con repositorio clonado por identificador | M5, M6, M14, M16 | H7 |
| **M18** Interfaz y sesiones | Volverme host, link, unirme, sesiones, estados visibles | M3, M7, M10, M16 | H1–H7 |
| **M19** Pruebas | Niveles de prueba y el entorno que los hace posibles | M1 | Todas |
| **M20** Diagnóstico | Logs por proceso, estados explícitos, errores con causa | M1 | H0, H1, H3, H5, H6 |

---

## 12. Reparto entre dos personas

Dos pistas que se tocan lo menos posible. Un orden puramente secuencial de épicas bloquearía a una de las dos, así que la pista de datos avanza en paralelo contra el contrato.

| Pista | Módulos | Carácter |
|-------|---------|----------|
| **A — Datos y publicación** | M3, M11, M12, M13, M14, M15, M17 | Base local y réplica, cola de trabajos, modelo, exportación, git, CLI |
| **B — Conexión y pizarra** | M4, M5, M6, M7, M8, M9, M10, M16, M18 | Orquestador, relay, sala, presencia, lienzo, versionado, interfaz |
| **Compartidos** | M1, M2, M19, M20 | Los dos. Las reglas del contrato, primero y juntos |

Propuesta de asignación, a ajustar entre ustedes:

- **David:** pista A. Es la que conecta con el CLI, git y la forma de trabajar de IOKOIA, donde ya tiene contexto.
- **Kua:** pista B. Es la separación orquestador y host, y el versionado de la pizarra, que fue lo que propuso en la junta.

Mientras la pista B lleva H1 a H4 por el camino crítico, la pista A construye la base local y la réplica —que H4 ya necesita para el historial— y el esqueleto del CLI contra el contrato. Cuando B termine H4, H5 tiene la mitad hecha.

### Puntos de contacto

Donde las pistas se encuentran, se acuerda antes de codear.

| Contacto | Entre | Qué se acuerda |
|----------|-------|----------------|
| Snapshot del commit | M10 (B) y M11 (A) | Qué recibe exactamente la tubería de publicación |
| JSON del tablero | M9 (B) y M14 (A) | Qué archivo se escribe y en qué ruta |
| Réplica por el relay | M3 (A) y M5 (B) | Cómo pasa la réplica sin mezclarse con la sesión |
| Estados del push | M11 (A) y M18 (B) | Qué estados ve la interfaz y cómo llegan |
| Rol del host | M16 (B) y M14 (A) | Quién valida que solo el host comitea |

---

## 13. Lo que bloquea, y cuándo

Decisiones de producto que detienen épicas. No se cierran implementando: se cierran preguntando y actualizando el documento que corresponda.

| Decisión abierta | Bloquea | Se necesita antes de |
|------------------|---------|----------------------|
| Si git entra en el alcance inicial | H5, y con ella H7 | **H4** — cambia la forma de la épica siguiente |
| Qué parte del tablero entra en staging | H4 | H4 |
| Licencia del almacenamiento en disco de la base local | H5 | H5 |
| Alcance del CLI en la v1: solo materializar, o también unirse a una sala | H5 | H5 |
| Proveedor de IA y si hace falta un modo sin modelo | H6 | H6 |
| Qué secciones exactas lleva el markdown | H6 | H6 |
| Cuándo entra autenticación | H7 con repositorios reales | Antes de la primera sala global con un repositorio del equipo |

Las dos primeras son las urgentes.

---

## 14. Fuera de la fase 1

- Migración de host cuando el host cae.
- Ramificación del historial de la pizarra.
- Control de acceso, link privado, contraseña.
- Maestro central en la nube.
- Markdown en tiempo real mientras se dibuja.
- Los módulos de IOKOIA Space (diseño, git, tareas, minutas, calendario, correo, agentes, depuración, metas, procedimientos, entidades, autenticación).
- Aplicación móvil.

Cuando lleguen, esos módulos entran como colecciones, pantallas y comandos de este motor, reutilizando la tubería de M11 y el contrato de M2.
