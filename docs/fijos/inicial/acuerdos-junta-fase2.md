# HaruKoia / IOKOIA — Ideas ordenadas (Fase 2)

Fuente: transcripción de junta (`20261002210900_rncaz6.minute.srt`), solo Fase 2.  
Nombres oficiales: **HaruKoia** · **IOKOIA** (Space).  
Regla: solo lo que se entiende del diálogo; lo dudoso del ASR va a la [Cola](#cola-sin-entender).

---

## 1. Contexto de la junta

| Fase | Tema | En esta nota |
|------|------|----------------|
| **1** | Leyenda (deploy, Coolify, DNS, dominio) | Omitida a propósito |
| **2** | HaruKoia / IOKOIA Space (arquitectura, pizarra, motor colaborativo) | Contenido de este documento |

Cambio de fase en la grabación: ~`00:50:37` (“Le damos al otro tema”).

Participantes: David Quecholac, Kua Arreola Sojo.

---

## 2. Alcance

### Corte inicial — HaruKoia

Con lo que querían empezar:

- Pizarra interactiva
- Sesiones
- Varias personas a la vez / presencia (quién está)
- Publicar la sesión
- Convertir publicaciones a Markdown
- Exportar (PDF, Word mencionados)
- Base local por dispositivo y en el CI

### Después / contemplado — IOKOIA Space

Lo que ya existe en IOKOIA se contempla para entrar al mismo motor (colecciones / pantallas / comandos), **no** como un servicio nuevo por cada capacidad:

- Sistema de diseño, tipologías, relaciones, mapa
- Git, tareas, minutas, calendario, correo
- Agentes, depuración, metas, procedimientos
- Entidades, autenticación (Authentik)

David: primero el motor; luego ir agregando esos módulos poco a poco.  
Kua: no es obligatorio incluir todos (ej. git o minutas pueden quedar fuera o ser más personales en agentes, salvo que quieran un agente compartido).  
Git: se puede sacar del alcance inicial si hace falta; Kua también pensó en conflictos entre Git y colaboración en vivo.

**Separación explícita:** cambios iniciales de HaruKoia ≠ cambios propuestos a futuro para IOKOIA.  
El motor se **construye contemplando** IOKOIA, aunque HaruKoia v1 no lo requiera todo.

---

## 3. Decisiones de arquitectura (propuesta que leyeron)

### Local-first + motor modular

- Cada navegador y cada CI tiene su base (RxDB).
- Sin red: se sigue leyendo y preparando cambios; al volver, la réplica se pone al día desde un checkpoint.
- Función nueva = módulo (esquema + pantalla + comando), compartiendo identidad, réplica y presencia.

### Microservicios: no como diseño por defecto

- Opción habitual (“un servicio por capacidad”) no gana aquí.
- Preferencia: **un motor**, varios procesos **solo donde el corte ya está claro**.
- Ejemplos de procesos aparte: pizarras (escalan por conexiones), IA/worker (escalan por trabajos).
- El resto se lee en local con RxDB; no un servicio por cada clic.
- Beneficio típico de microservicios (muchos equipos, dueños de dominio) no aplica: son pocos.
- Fronteras IOKOIA ↔ pizarra todavía se van a mover → mal momento para cortar por microservicios rígidos.

### Monorepo

- El monorepo es el hogar del código (no implica un solo proceso en runtime).
- Paquetes mencionados en la propuesta: App Web, App Sync, App Replicate, Apps Worker, Apps CI, Package Schema, Package Domain (nombres según lectura del doc en junta).

### Nuevo motor vs extender IOKOIA hoy

- Extender Space/CI solo para una pantalla suelta sería más corto, pero se descartó: el objetivo es un **motor completo**; IOKOIA emigrará hacia él cuando el motor funcione.
- Construir la pizarra “dentro del cupo actual” (diseño viejo de proceso por máquina / stack embebido) costaría más sacarlo después que empezar con el corte correcto.

### Stack en vivo / datos (propuesta inicial)

- **Pizarra en vivo:** tldraw + **Yjs** (CRDT; fusión de trazos sin candado; cursores/nombres).
- **Servidor Yjs primer corte:** **Hocuspocus** (WebSockets; auth en hook de conexión; persistencia del documento; presencia).
- Escala futura: varios nodos de sync + Redis para repartir actualizaciones (una DB normal no aguanta cientos de ops de dibujo/s).
- **Réplica / documentos publicados:** propuesta inicial con **MongoDB** como maestro de réplica; RxDB en cliente/CI.
- Dos tipos de datos: trazo inmediato (sesión CRDT) vs publicación (Markdown/PDF/avisos) como documento que se replica después; publicar crea versión nueva (inmutable), no pisa la anterior.
- Flujo resumido en doc: quienes están en junta comparten tablero por sync; publicar congela snapshot y encola trabajo; worker produce Markdown; navegador/CI reciben por pull / streaming; CI materializa Markdown; Git sigue siendo copia que el equipo revisa.
- **RxDB vs Postgres:** RxDB cubre base local + réplica + conflictos; Postgres “solo servidor” obligaría red o copia local a mano.
- Una sala / space por función (límite práctico primer corte: un nodo sync; una sala por space).
- Fuera de la sala: quien no abrió el web se entera por réplica (CI/web al abrir): última versión, título, autores, fecha, estado — sin presencia permanente en sync si no está en la sala.

Kua (primera lectura): conexión, retomar, y Mongo como remoto/maestro le parecían bien; la duda era qué modelos incluir en la pizarra (inventario arriba del doc).

---

## 4. Acuerdos que cambian / afinan la propuesta

### Roles: host y espectadores

Problema: si varios tienen réplica local y escriben Markdown/commits, tres personas pueden comitear lo mismo → conflictos o commits duplicados.

Acuerdo:

- Roles: **host** (dueño de sala) y **espectadores**.
- Solo el host hace el commit / “sube”.
- Host = rol de líder; roles desde el inicio es valor de producto (pocas apps colaborativas lo marcan bien).
- David: si se puede, **mandar Mongo a la verga** e **implementar host desde el inicio** en la pizarra base.

### Persistencia sin Mongo (dirección acordada)

- Al quitar Mongo: los datos tienen que persistir en el host.
- Markdown en disco en vivo es lento (leer/escribir árboles).
- Alternativa razonable: RxDB + Node en el host con almacenamiento local (ej. **SQLite**), más optimizado.
- Se mantiene la línea de **escribir Markdown** como exportación/versión, no como motor de escritura continua.

### Markdown no en tiempo real

Aclaración fuerte de David:

- La intención **nunca** fue escribir Markdown en tiempo real mientras dibujan.
- Se guarda la info en la pizarra; al terminar (o al cerrar un bloque) se hace **push** = convertir a Markdown y subir.
- En vivo: actualizar en la nube/sesión; al terminar se manda a los demás / se exporta.
- Kua alineado: performance era el miedo a escritura constante; con este modelo sirve.

### Push / pull: dos significados

- **En vivo / colaborativo:** sync de datos de sesión (no es “git push”).
- **Al host / Git:** push como commit / export de la pizarra (análogo a idea de update del CI de IOKOIA: pushear para que otros jalen).
- Guardar pizarra = estado espacio-temporal de elementos (trazos/coordenadas), no solo “texto suelto”.
- Formato: traducir trazos a JSON (u otro) que se pueda bajar a archivo y subir a Git (“traductor”).

### Control de versiones en la pizarra (alcance ambicioso, pero deseable)

Kua propone (incluso para versión HaruKoia):

- Staging colaborativo + botón “guardar” = commit de versión oficial de la pizarra.
- Historial de versiones con checkout entre ellas (y más adelante ramificación).
- David: encaja con push/pull; el push puede pushear la pizarra entera, no solo Markdown.

### Salas globales vs salas de usuario (host)

- No hace falta replicar “todo con todos” siempre.
- Caso de uso: tú trabajas en una tarea/diseño; invitas; lo colaborado se refleja en **tu** working copy; el otro no necesita la misma rama ni clonar el repo.
- **Salas host (local):** el host es el usuario.
- **Salas globales:** mismo esquema de host, pero el host está en la nube (ej. pizarras de know-how; repo cargado por ID sin clon local de cada quien; bot clona en server y de ahí se sube a Git cuando toque).
- Analogía: en Miro el host “es Miro”; para repos de devs, host global = servidor; host de “trabajar juntos” = el developer.

### Flujo de UI para sesiones

- Misma UI siempre.
- Acción: **“Volverme el host”** → switch (nube / home-local) → genera **link** para invitar (share).
- Poder unirse; activar/desactivar online/offline.
- Varias sesiones a la vez.
- Controles de acceso (quién se une, link privado, contraseña) = después (“florecitas”); primero que funcione.

### Orquestador vs contenedor host (2 contenedores)

Kua: si se separan hosts, desde el principio:

1. App / Space / pizarra = **orquestador** (coordina, sync, registra instancias).
2. Contenedor aparte = **host de datos** (almacena datos + repo; host genérico).

No un solo server haciendo las dos cosas.  
David: OK, dos contenedores; se puede desplegar con Docker / **Docker Compose**.  
Kua: basta separar a nivel de código (uno hace una cosa, el otro otra).

---

## 5. Agente / Cursor / sesiones compartidas

David:

- Bloqueo actual: cuenta de Cursor en varios dispositivos / IPs (incluye server donde montaron IOKOIA Space) → riesgo shadow ban.
- Idea: una sola sesión/cuenta en el servidor del Space; el agent ahí procesa solicitudes; misma cuenta, una sesión.
- Sesiones no solo en el tablero: por space (tareas, minutas, calendario…); ver cursor/nombre de otros en IOKOIA Space.

Kua: sí era la visión remota, pero menos aterrizada; aquí (sesiones compartidas tipo Yjs rooms/sesiones) está más robusto.

---

## 6. Repo y siguientes pasos

- David crea un repo en su GitHub de escuela; invitan a Kua; cuando el motor esté, se clona/pasa a IOKOIA (no mezclar equipo escolar con org de IOKOIA).
- David pide: pasar transcripción Fireflies **solo de esta parte** de la junta → a la IA → documento de **cambios** (propuesta inicial vs lo acordado hoy), sin todo el texto de nuevo → y empezar desarrollo.
- Nota a la IA: no dejar Mongo “adaptable” a medias si ya se decidió host; implementar host; aclarar Markdown solo al push al final de sesión.

---

## 7. tldraw (librería de pizarra)

Evaluación en junta (mirando docs/demo):

- Se ve bien; React SDK; carga muy simple (`import` → editor).
- Parecido visual a ClickUp (comentaron que ClickUp quizás lo usa / case study).
- Lo usan marcas conocidas (mencionaron Autodesk, etc.); muchas descargas.
- No es Miro (Miro está enfocado en ser la herramienta); para su caso les sirve.
- Widgets / notas custom: posible vía el motor del SDK.
- Veredicto de material leído: recomendado para prototipar / brainstorm / validar ideas tempranas (no esperar “product-ready code” del sketch).

Acuerdo de tono: con los ajustes de arquitectura (host, etc.), lo ven bien para seguir.

---

## Cola (sin entender)

Fragmentos del ASR o laterales que **no** se interpretaron. Cita corta + timestamp. Sin inventar significado.

| Timestamp | Cita / nota |
|-----------|-------------|
| ~00:53:00 | “motor de aplicación local Tears en un script con proceso web con React TD…” (resto se interpretó como tldraw+React; “Tears/script” quedó opaco) |
| ~00:56:09 | “worker node cola paddock model para mardon y nodmas y el ci con notmas…” |
| ~00:56:44 | “agentes, día, depuración… auténtico ICD” (Authentik se asumió en el cuerpo; “ICD/día” no) |
| ~00:57:25 | “Un proceso puede crecer sin investigar a los demás” (posible ASR de “sin afectar”) |
| ~01:00:38 | “extender y ocolga ci” / “opace emigrará” |
| ~01:00:52 | “archivos vigilados de chucky day y un next que embebe nest” |
| ~01:03:34 | “el funnel pasa ready” / “binitial sync” / “almacenamiento dixi Indexdb… paquete de pago” |
| ~01:03:58 | “procesador Copus Aut” / “réplica Snake JS” |
| ~01:04:41 | “Para Warnes el límite práctico…” |
| ~01:05:31 | Diálogo “en la cabeza / arriba del documento” (meta de UI al leer el doc; sin idea de producto) |
| ~01:11:19 | “The whole.” (suelto) |
| ~01:11:48–01:12:18 | “pídele que documente este proceso… Leech… narre lo que hizo de inicio” — suena a resto de otra tarea/deploy, no a HaruKoia |
| ~01:16:17 | “va a estar en ADB central” (¿RxDB? no forzado) |
| ~01:16:52 | “ID del MEPO” |
| ~01:31:46 | “How no Coke know how” / “abre la pizarra en automático” |
| ~01:31:56 | “es word use y que entres y te diga nada” |
| ~01:36:29 | “Garet Gareth te mando la grabación” |
| ~01:36:46 | “acá el local aquí olivia lo recuerdo” |

---

## Correcciones ASR usadas en el cuerpo (confirmadas)

| ASR / ruido | Lectura usada |
|-------------|----------------|
| JS / YW / YWS / CRT | Yjs / CRDT |
| ocus pocus / Copus / horóscopos | Hocuspocus |
| tidral / veactral / T from T | tldraw |
| mardon / Martens / Marda | Markdown |
| auténtico / authentic | Authentik |
| con Bose | Docker Compose |
| Fireflash | Fireflies |
| Yokoya / Yokoi / Harokoyes | **IOKOIA** / **HaruKoia** |
