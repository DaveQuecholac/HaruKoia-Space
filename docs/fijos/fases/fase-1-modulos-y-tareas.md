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

> **Stack vigente.** La base local y la réplica (M3) son **PowerSync**, con una réplica central de lectura que solo alimenta el host y que **no pasa por el relay** (2026-10-19). El frontend de la v1 es **React Native con Expo** (2026-11-04). Antes de H2 se escribe el diseño de esa app. Antes de H4 va la prueba de la réplica, en [plan-pdc-stack-powersync-react-native.md](../../dev/dev/motor/plan-pdc-stack-powersync-react-native.md). Ver la v2, secciones 4, 5 y 13.

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
| **H6** | La IA interpreta una zona de la pizarra | Recorte de lo que se ve, Bedrock, Markdown con el nombre elegido; Word y PDF después | Que el documento sea un volcado del tablero |
| **H7** | La sala vive en el servidor | Sala global sin que nadie clone el repositorio | Operación del host fuera de la máquina del developer |

### Por qué ese orden

**H1 antes que la pizarra.** El riesgo mayor no es dibujar juntos —eso lo resuelven las librerías— sino que un invitado en otra red alcance al host a través del relay. Si falla en la semana dos se replantea barato; en la semana ocho ya hay una pizarra construida encima.

**H3 donde está, no al final.** La resistencia a caídas suele dejarse para el cierre y es lo que mata estos proyectos: una pizarra que pierde trabajo cuando el host suspende la laptop no es usable, y arreglarlo después obliga a rehacer la sala.

**H4 antes de publicar.** Staging, commit y checkout sobre un tablero no son un patrón que podamos copiar de ningún lado. Hay que usarlo un par de semanas antes de construir la publicación encima.

**H5 publica sin IA.** La publicación de la pizarra es un markdown **determinista** —versión, participantes, fecha, notas del tablero— verificable carácter por carácter. Así se depuró el transporte sin depurar al mismo tiempo una salida que cambia en cada corrida. Queda como la publicación del tablero. La IA no es otra variante de ese push: es una herramienta aparte (H6) que mira una zona y escribe su propio documento.

### Despliegue al cerrar cada épica

Cada épica se demuestra en el **entorno compartido** (Coolify, Makino Hara), no solo con `pnpm dev`. La rama que se despliega es **`development`**. Al cerrar la épica se redespliega el proceso que esa épica dejó usable para otra persona.

| Épica | Qué se despliega | Qué no se sube |
|-------|------------------|----------------|
| **H0** | Nada. La prueba es local | Todo |
| **H1** | Orquestador (`APP=orchestrator`, `GET /health`) | Host y web. El host marca hacia el orquestador compartido desde la laptop |
| **H2** | Orquestador y **web** (`APP=web`). Dominio `https://web.harukoia.makinohara.sys.iokoia.com`. El build hornea `VITE_ORQUESTADOR_URL` al orquestador compartido y `VITE_HOST_URL` a `https://host.harukoia.local.iokoia.dev` | El host de la sala de usuario. Sigue en la laptop. `WEB_ORIGEN` de ese host es el origen de la web pública, para que "Volverme host" salga de esa web en la misma máquina. Un teléfono solo abre el link; no es host |
| **H3** | Orquestador y web, si el cambio los tocó. El disco de la sala sigue en la laptop del host | El host |
| **H4** | La **réplica central** (Postgres, PowerSync Service y backend de escritura), aparte del orquestador. No pasa por el relay. Solo el host la alimenta | El host, que sigue siendo quien escribe |
| **H5** | Lo que esa épica cambie en orquestador, web o réplica. El CLI se corre en la máquina | El CLI no es un proceso de Coolify |
| **H6** | La web, con la herramienta de recorte. El host llama a Bedrock; no hay proceso nuevo | El CLI. `space update` ya baja lo que el host haya subido a git |
| **H7** | El contenedor host de la **sala global** | La sala de usuario puede seguir con el host en la laptop |

El orquestador no guarda el tablero. La web pública tampoco: sirve el lienzo y habla con el orquestador. La réplica no entra en el despliegue de H2.

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
| M8 Pizarra | | | ● | ◐ | | | ◐ | |
| M9 Traductor | | | | | ● | | | |
| M10 Staging y commits | | | | | ● | | | |
| M11 Push | | | | | | ● | | |
| M12 Markdown con IA | | | | | | | ● | |
| M13 Exportación | | | | | | | ● | |
| M14 Git | | | | | | ● | ◐ | ◐ |
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

**Lo que la bloquea.** El diseño de la app Expo: pantallas, tldraw en un componente DOM, y el arranque con PM2 y portless. React Native ya entra. Ese documento se escribe antes de construir H2. Las pantallas de H1 siguen en Vite hasta entonces.

**Definition of done.**
1. El trazo de una persona aparece en la otra pantalla por debajo del objetivo de latencia.
2. Con diez clientes el tablero converge al mismo estado.
3. Quien se queda sin red sigue dibujando y al volver no pierde nada.
4. La web está desplegada en el entorno compartido desde `development`. Otra persona abre el link de invitación sin clonar el repositorio. El host de esa sala sigue en la laptop.

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
| H4-T9 | Historial replicado a los invitados, leído de la réplica central con PowerSync | M3 |
| H4-T10 | Pruebas de ida y vuelta del traductor y del grafo de commits | M19 |

**Definition of done.**
1. Se guarda, se ve el historial, se vuelve a una versión y se sigue trabajando desde ahí.
2. Un tablero exportado y reimportado es idéntico.
3. El archivo JSON se entiende en un diff de git.
4. El commit después de un checkout cuelga del commit correcto.

**Decisiones que la bloqueaban (cerradas 2026-11-17).** Staging = **toda la pizarra**. Réplica: sube metadatos + snapshot + JSON; backend de escritura como proceso propio; token de lectura JWT RS256 desde ese backend; buckets en Postgres `powersync_storage`. Detalle y PdC: [docs/dev/dev/versiones-pizarra/](../../dev/dev/versiones-pizarra/README.md).

**H4 cerrada (2026-11-22).** En UI el gesto de versión es **Crear versión / Commitear** (no “guardar”). Tras commit, el host compacta el Doc Yjs vivo en `sala.sqlite` (estado codificado). V0–V9 hechos; suites verdes; el chat aprobó el cierre. Evidencia: [evidencia-h4-cierre.md](../../dev/dev/versiones-pizarra/evidencia-h4-cierre.md). Siguiente: H5.

---

## 8. H5 — Lo guardado llega al repositorio de quien no estuvo

> **Historia.** Guardo una versión, hago push, y alguien que no estuvo en la junta corre un comando y tiene los archivos en su repositorio.

**Alcance.** Tubería de publicación, salida determinista sin IA, escritura en la copia de trabajo, commit y push a git, y el CLI.

**No entra.** La IA (H6) y los adjuntos PDF y Word (H6).

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H5-T1 | Tablas de documentos (adjuntos binarios: H6) en el contrato | M2 |
| H5-T2 | Espejo PowerSync en el host — **delta `documents`** (commits/cola base: H4) | M3 |
| H5-T3 | Réplica central — **delta `documents`** (estación y backend: H4) | M3 |
| H5-T4 | Cola de trabajos de publicación en el host | M11 |
| H5-T5 | Mecanismo genérico de publicación con variantes de formato | M11 |
| H5-T6 | Variante determinista: markdown sin modelo, a partir del commit | M11 |
| H5-T7 | Estados replicados: en proceso, publicado, fallido, y reintento (UI **después** del push) | M11, M18 |
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

**Decisiones que la bloqueaban (cerradas 2026-11-22; D-H5-5 actualizado 2026-11-25).** Git **sí** en el alcance (commit + push + remoto adelantado). `space update` materializa **desde git** (la réplica no sustituye el repo). CLI v1: solo `space host` / `status` / `update` (no unirse a sala). Sala↔repo al arrancar el host dentro del checkout; generados en el **toplevel git** bajo **`Harukoia/Pizarra/…`** (pizarra) y **`Harukoia/documentacion/…`** (IA / H6). Backend de escritura y PowerSync: ya cerrados en H4. Detalle: [docs/dev/dev/publicaciones-pizarra/](../../dev/dev/publicaciones-pizarra/README.md).

**H5 cerrada (2026-11-25).** P0–P11 hechos; el chat aprobó el humo. Publicación determinista a `Harukoia/Pizarra/…`, git commit/push (remoto adelantado), estados en UI, CLI `space host` / `status` / `update` (idempotente), E2E con remoto git local. Evidencia: [evidencia-h5-cierre.md](../../dev/dev/publicaciones-pizarra/evidencia-h5-cierre.md). Siguiente: H6 (otra rama).

---

## 9. H6 — La IA interpreta una zona de la pizarra

> **Historia.** Elijo la herramienta, enmarco la zona que quiero que mire —como un recorte de pantalla— y le pongo nombre. Bedrock ve esa zona y escribe un Markdown que es su interpretación. Después, de ese mismo Markdown salen un Word y un PDF.

**Alcance.** Herramienta en la pizarra, llamada a Bedrock con la imagen de la zona, y el Markdown con el nombre elegido en `Harukoia/documentacion/`. Word y PDF entran después, con un convertidor propio de ese Markdown. Sin Pandoc ni otro conversor externo.

**No entra.** Volcar formas, coordenadas o el JSON del tablero dentro del documento. Secciones fijas. Disparar la IA al hacer push de la pizarra. Un proceso nuevo: la llamada sale del host. Un comando nuevo de CLI: `space update` ya baja el archivo cuando está en git. Que alguien que no es el host dispare la llamada (la primera rebanada la usa el host, que es quien escribe el repo).

| Tarea | Qué | Módulo |
|-------|-----|--------|
| H6-T1 | Herramienta de recorte: rectángulo sobre lo que se ve, y nombre del documento | M8, M18 |
| H6-T2 | Raster de esa zona. La entrada del modelo es la imagen, no el JSON | M12 |
| H6-T3 | Bedrock devuelve el Markdown de la interpretación | M12 |
| H6-T4 | El host escribe `Harukoia/documentacion/<nombre>.md`. Si la llamada falla, no hay archivo | M12, M14 |
| H6-T5 | El archivo sale por el git y `space update` ya existentes | M14, M15 |
| H6-T6 | Modelo simulado en las pruebas; el camino real llama a Bedrock | M12, M19 |
| H6-T7 | Convertidor propio: Word y PDF del mismo Markdown. Reintento sin volver a llamar al modelo | M13 |

**Definition of done.**
1. Enmarcas una zona, le pones nombre, y queda un Markdown que es la interpretación de lo que se ve ahí.
2. Ese archivo no es el volcado de formas ni de coordenadas. Eso sigue viviendo en la publicación de la pizarra (H5).
3. Quien no estuvo lo recibe con `space update` o con git.
4. Word y PDF salen de ese Markdown con el convertidor propio, sin una segunda lectura del tablero.

**Decisiones.** Proveedor: **Bedrock** (2026-11-26). No hay secciones fijas: el documento es la interpretación y el nombre lo elige quien usa la herramienta. La publicación H5 no llama al modelo; si no se usa la herramienta, no sale nada a Bedrock. Si el nombre ya existe en `Harukoia/documentacion/`, el archivo nuevo es `<nombre> v2.md`, luego `v3`, y el anterior queda (2026-11-26). Plan: [docs/dev/dev/documentos-ia/](../../dev/dev/documentos-ia/README.md).

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
| **M3** Base local y réplica | SQLite de PowerSync en host y clientes; cola de subida del host; réplica central (backend de escritura, Postgres, PowerSync Service). No pasa por el relay | M2 | H4, H5 |
| **M4** Registro de salas | `identificador de sala → conexión del host`, links, resolución. No persiste | M1 | H1, H3, H7 |
| **M5** Relay | Mover bytes entre invitados y host. Conexión saliente del host | M4 | H1, H3, H7 |
| **M6** Sala en vivo | Documento compartido de la sesión en el host, con persistencia | M5, M2 | H1, H2, H3 |
| **M7** Presencia | Quién está y en qué: nombre, cursor, foco | M6 | H1, H2 |
| **M8** Pizarra | Lienzo: formas, selección, cámara, conectado a la sala | M6, M7 | H2, H3 |
| **M9** Traductor | Tablero a JSON portable y de vuelta. Es el archivo que git revisa | M8, M2 | H4 |
| **M10** Staging y commits | Staging, commit con padre y participantes, historial, checkout | M6, M9, M16 | H4 |
| **M11** Push | Tubería de publicación: cola, variantes de formato, estados | M10, M3 | H5, H6 |
| **M12** Interpretación con IA | Herramienta de recorte, imagen de la zona, Bedrock, Markdown con el nombre elegido | M8, M14 | H6 |
| **M13** Convertidor | Word y PDF a partir de ese Markdown. Código de este motor; sin Pandoc ni otro conversor externo | M12 | H6 |
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

La pista B, antes de H2, escribe el diseño de la app Expo. La pista A, antes de H4, hace la prueba de la réplica central. Ninguna de las dos se arranca sin ese documento y sin confirmación en el chat.

### Puntos de contacto

Donde las pistas se encuentran, se acuerda antes de codear.

| Contacto | Entre | Qué se acuerda |
|----------|-------|----------------|
| Snapshot del commit | M10 (B) y M11 (A) | Qué recibe exactamente la tubería de publicación |
| JSON del tablero | M9 (B) y M14 (A) | Qué archivo se escribe y en qué ruta |
| Réplica fuera del relay | M3 (A) y M5 (B) | La réplica va del host a la réplica central y de ahí a los lectores. M5 no la transporta: el relay solo lleva la sala en vivo |
| Token de lectura | M3 (A) y M16 (B) | Quién emite el JWT de PowerSync, contra qué credencial de la sala y con qué alcance |
| Estados del push | M11 (A) y M18 (B) | Qué estados ve la interfaz y cómo llegan |
| Rol del host | M16 (B) y M14 (A) | Quién valida que solo el host comitea |

---

## 13. Lo que bloquea, y cuándo

Decisiones de producto que detienen épicas. No se cierran implementando: se cierran preguntando y actualizando el documento que corresponda.

| Decisión abierta | Bloquea | Se necesita antes de |
|------------------|---------|----------------------|
| ~~Si git entra en el alcance inicial~~ | — | **Sí** (commit + push + remoto adelantado; 2026-11-22) |
| ~~Qué parte del tablero entra en staging~~ | — | **Toda la pizarra** (2026-11-17) |
| ~~Licencia del almacenamiento en disco de la base local~~ | — | Resuelta el 2026-10-19: PowerSync autoalojado, gratis |
| Diseño de la app Expo: pantallas, lienzo y arranque con PM2 y portless. React Native ya entra | Construir la app | Diseño ya escrito en H2; construir es otra autorización |
| ~~Qué sube a la réplica central~~ | — | Metadatos + snapshot + JSON (2026-11-17) |
| ~~Dónde vive el backend de escritura~~ | — | Proceso propio junto a la réplica (2026-11-17) |
| ~~Quién emite el token de lectura~~ | — | JWT RS256 desde el backend de escritura (2026-11-17) |
| ~~Almacén de buckets~~ | — | Postgres `powersync_storage` (2026-11-17) |
| ~~Reglas H0 vs PowerSync~~ | — | Client schema en el espejo; Yjs H3 aparte (2026-11-17) |
| ~~Si `space update` baja de git o lee de la réplica~~ | — | **Desde git** (2026-11-22) |
| ~~Alcance del CLI en la v1~~ | — | Solo `host` / `status` / `update`; no unirse a sala (2026-11-22) |
| ~~Rutas de generados / vínculo sala↔repo~~ | — | `Harukoia/Pizarra/…` + `Harukoia/documentacion/…` (H6); toplevel git (2026-11-22; rutas/raíz 2026-11-25) |
| ~~Proveedor de IA~~ | — | **Bedrock**, llamada desde el host (2026-11-26). La publicación H5 no usa modelo |
| ~~Secciones fijas del markdown de la IA~~ | — | No hay. El archivo es la interpretación; el nombre lo elige quien usa la herramienta (2026-11-26) |
| ~~Nombre repetido en `Harukoia/documentacion/`~~ | — | `<nombre> v2.md`, luego `v3`, sin pisar el anterior (2026-11-26) |
| Cuándo entra autenticación | H7 con repositorios reales | Antes de la primera sala global con un repositorio del equipo |

**H5 cerrada (2026-11-25).** Evidencia: [evidencia-h5-cierre.md](../../dev/dev/publicaciones-pizarra/evidencia-h5-cierre.md). Plan: [publicaciones-pizarra](../../dev/dev/publicaciones-pizarra/README.md). Siguiente urgencia de producto: H6 (herramienta de recorte e interpretación con Bedrock).

---

## 14. Fuera de la fase 1

- Migración de host cuando el host cae.
- Ramificación del historial de la pizarra.
- Control de acceso, link privado, contraseña.
- Un maestro central que escriba. La réplica central solo la alimenta el host.
- Markdown en tiempo real mientras se dibuja.
- Los módulos de IOKOIA Space (diseño, git, tareas, minutas, calendario, correo, agentes, depuración, metas, procedimientos, entidades, autenticación).
- El teléfono como host local. En el móvil se entra como espectador o a una sala global.

Cuando lleguen, esos módulos entran como colecciones, pantallas y comandos de este motor, reutilizando la tubería de M11 y el contrato de M2.
