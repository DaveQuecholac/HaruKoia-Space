# Fase 1 — Módulos y tareas

Desglose de **todos** los módulos grandes del motor colaborativo para la fase 1, con qué hace cada uno, de qué depende, con qué trabaja, y una propuesta de reparto entre dos personas.

Base: [análisis de arquitectura v2](../arquitectura/analisis-arquitectura-v2.md). Las decisiones cerradas de ahí no se reabren en este documento.

Fase 1 es **el motor funcionando**: una sala con varias personas dibujando, un commit de la pizarra, y el markdown llegando al repositorio de alguien que no estuvo en la sesión. Los módulos de IOKOIA Space **no** son fase 1.

---

## 1. Mapa de módulos

Veinte módulos, en cuatro grupos.

| Grupo | Módulos |
|-------|---------|
| **Plataforma** | M1 Arranque · M2 Esquemas y dominio · M3 Base local y réplica · M19 Pruebas · M20 Diagnóstico |
| **Conexión** | M4 Registro de salas · M5 Relay · M6 Sala en vivo · M7 Presencia · M16 Identidad y roles · M17 Sala global |
| **Pizarra y versiones** | M8 Pizarra · M9 Traductor · M10 Staging y commits · M18 Interfaz y sesiones |
| **Publicación** | M11 Push · M12 Markdown con IA · M13 Exportación · M14 Git · M15 CLI |

```text
M1 Arranque
  └─ M2 Esquemas y dominio ──────────────┬──────────────┬─────────────┐
       │                                 │              │             │
       ├─ M3 Base local y réplica ───────┤              │             │
       │     │                           │              │             │
       │     ├─ M15 CLI ─── M14 Git      │              │             │
       │     └─ M11 Push ─┬─ M12 IA      │              │             │
       │                  └─ M13 Export  │              │             │
       │                                 │              │             │
  M4 Registro ─ M5 Relay ─┬─ M6 Sala ─┬──┴─ M7 Presencia              │
                          │           │                               │
                          │           └─ M8 Pizarra ─ M9 Traductor ─ M10 Commits
                          │                                            │
                          └─ M16 Identidad y roles      M18 Interfaz ──┘
                                   │
                                   └─ M17 Sala global

  M19 Pruebas y M20 Diagnóstico cruzan todo
```

---

## 2. Plataforma

### M1 — Arranque y monorepo

**Qué hace.** Paquetes, dependencias, arranque con PM2 y portless, contenedores, typecheck y pruebas en un solo gesto.

**Depende de.** Nada.
**Trabaja con.** Todos.

| Tarea | Detalle |
|-------|---------|
| M1-T1 | `pnpm install` limpio y `pnpm dev` arrancando las tres apps con logs |
| M1-T2 | `pnpm dev:stop`, `dev:status` y `dev:restart` verificados en la máquina de cada quien |
| M1-T3 | Inicializar git, primera rama de trabajo y carpeta en `docs/dev/` |
| M1-T4 | `pnpm typecheck` y `pnpm test` corriendo en vacío sin errores |
| M1-T5 | `pnpm docker:up` levantando orquestador y host, con `/health` respondiendo |

**Hecho cuando.** Las dos personas pueden levantar el motor y apagarlo sin pedir ayuda, y los dos contenedores arrancan.

Estado: esqueleto creado. Falta git, instalar dependencias y verificar en ambas máquinas.

### M2 — Esquemas y dominio

**Qué hace.** El contrato de datos del motor: qué es una sala, un commit, un snapshot, un documento y un adjunto. Versiones de esquema y sus migraciones. Nombres de archivo de lo que se materializa en el repositorio y las secciones del markdown.

**Depende de.** M1.
**Trabaja con.** M3, M6, M10, M11, M15. Es la pieza que impide que el host y el CLI definan lo mismo de dos formas.

| Tarea | Detalle |
|-------|---------|
| M2-T1 | Colecciones `rooms`, `commits`, `snapshots`, `documents`, `attachments` con sus campos |
| M2-T2 | Campos de control de la réplica: orden determinista y marca de borrado |
| M2-T3 | Versionado de esquema y el mecanismo de migración en el cliente |
| M2-T4 | Tipos de dominio: estados de sala, de commit y de push |
| M2-T5 | Nombres y rutas de los archivos que el CLI escribe en el repositorio |

**Hecho cuando.** Web, host y CLI compilan contra el mismo contrato y una colección nueva no obliga a tocar los tres.

**Riesgo.** Es el módulo que más cuesta cambiar después. Conviene cerrarlo entre las dos personas antes de repartir el resto.

### M3 — Base local y réplica

**Qué hace.** La base local en el navegador y en el CLI, y los tres puntos que el host expone para replicar: traer desde un checkpoint, recibir escrituras y emitir el stream de novedades. Incluye el reenganche cuando se pierden eventos.

**Depende de.** M2.
**Trabaja con.** M8 y M18 (lecturas de la interfaz), M15 (CLI), M11 (estados de publicación).

| Tarea | Detalle |
|-------|---------|
| M3-T1 | Base local del navegador y consultas reactivas |
| M3-T2 | Base local del host con almacenamiento en disco |
| M3-T3 | Los tres puntos de réplica en el host |
| M3-T4 | Reenganche: recorrer desde el checkpoint cuando el stream perdió eventos |
| M3-T5 | Política de conflicto: la versión publicada es inmutable, así que el conflicto es la excepción |
| M3-T6 | Caso del invitado que escribe sin red y se fusiona al restaurarse la sala |

**Hecho cuando.** Dos clientes y el CLI convergen contra el mismo host, incluso después de perder la red un rato.

**Decisión pendiente.** El almacenamiento en disco de la base local está en el paquete de pago de RxDB. Hay que confirmar la licencia antes de M3-T2.

### M19 — Pruebas y entorno de pruebas

**Qué hace.** Los niveles de prueba del análisis de arquitectura y el entorno que los hace posibles: compose con orquestador, host, remoto git local y modelo de IA simulado.

**Depende de.** M1, y de cada módulo que prueba.
**Trabaja con.** Todos.

| Tarea | Detalle |
|-------|---------|
| M19-T1 | Compose de pruebas con remoto git local y modelo simulado |
| M19-T2 | Arnés de varios participantes: clientes de sala sin navegador, de 2 a 10 |
| M19-T3 | Pruebas de convergencia, presencia, invitado que se va y vuelve, host que cae |
| M19-T4 | Pruebas de resistencia: matar relay, matar host, partir la red, inyectar latencia |
| M19-T5 | Medición de los objetivos de rendimiento del análisis |
| M19-T6 | Pruebas de extremo a extremo: dos navegadores, dibujar, commitear, verificar el archivo |

**Hecho cuando.** La prueba de varios participantes corre en la máquina de cualquiera de los dos y falla cuando debe fallar.

**Nota.** M19-T2 no es opcional ni se deja para el final. Es la única forma de saber si el motor colaborativo colabora.

### M20 — Diagnóstico

**Qué hace.** Que un fallo se vea y se entienda: estados explícitos, logs por proceso, y errores que dicen qué pasó en lugar de un error de red genérico.

**Depende de.** M1.
**Trabaja con.** Todos, sobre todo M5, M11 y M14.

| Tarea | Detalle |
|-------|---------|
| M20-T1 | Logs por proceso con el identificador de sala |
| M20-T2 | Estados visibles en la interfaz: conectado, reconectando, sala cerrada |
| M20-T3 | Errores de publicación con causa y acción posible |

---

## 3. Conexión

### M4 — Registro de salas y links

**Qué hace.** El orquestador registra `identificador de sala → conexión del host`, genera el link de invitación y resuelve a qué host va cada invitado. Nada de esto se persiste.

**Depende de.** M1.
**Trabaja con.** M5, M16, M18.

| Tarea | Detalle |
|-------|---------|
| M4-T1 | Registro en memoria y alta del host al arrancar |
| M4-T2 | Identificador de sala largo y aleatorio, y generación del link |
| M4-T3 | Rechazo claro si dos hosts reclaman la misma sala |
| M4-T4 | Baja de la sala cuando el host se desconecta |
| M4-T5 | Reinicio del orquestador: los hosts se vuelven a registrar |

**Hecho cuando.** Un host se registra, el link funciona, y al apagar el host la sala desaparece del registro.

### M5 — Relay

**Qué hace.** Mover bytes entre los invitados y el contenedor host. El host abre la conexión **hacia** el orquestador, así que funciona detrás de NAT sin abrir puertos.

**Depende de.** M4.
**Trabaja con.** M6, M3 (la réplica del navegador también pasa por aquí), M16.

| Tarea | Detalle |
|-------|---------|
| M5-T1 | Conexión saliente del host y su registro |
| M5-T2 | Reenvío por identificador de sala en ambos sentidos |
| M5-T3 | Reconexión automática de host y de invitados |
| M5-T4 | Aviso explícito al invitado cuando la sala se cerró, no un error genérico |
| M5-T5 | Prueba detrás de NAT real, con las dos máquinas en redes distintas |

**Hecho cuando.** Alguien en otra red entra por el link y ve el tablero del host sin configurar nada.

**Riesgo.** Es el módulo con más superficie de fallo de red. M19-T4 lo cubre a propósito.

### M6 — Sala en vivo

**Qué hace.** El documento compartido de la sesión dentro del contenedor host, con persistencia para sobrevivir un reinicio. La autoridad está aquí, no en el navegador del host.

**Depende de.** M5, M2.
**Trabaja con.** M7, M8, M10.

| Tarea | Detalle |
|-------|---------|
| M6-T1 | Servidor de sala en el host y entrada de clientes |
| M6-T2 | Persistencia del documento de la sesión en disco |
| M6-T3 | Restauración de la sala en el último estado al volver a arrancar |
| M6-T4 | Compactación del documento al commitear |
| M6-T5 | Puerta de entrada: solo entra quien trae un link válido |

**Hecho cuando.** Dos personas dibujan a la vez, el host reinicia, y al volver la sala está en el último estado.

### M7 — Presencia

**Qué hace.** Quién está en la sala y en qué: nombre, cursor y foco. Es la conciencia dentro de la junta.

**Depende de.** M6.
**Trabaja con.** M8, M18.

| Tarea | Detalle |
|-------|---------|
| M7-T1 | Identidad de sesión del invitado: nombre visible |
| M7-T2 | Cursores y selección de los demás en el lienzo |
| M7-T3 | Lista de participantes con su rol, host o espectador |
| M7-T4 | Salida limpia: el participante desaparece al cerrar |

**Hecho cuando.** Con cinco personas, cada una ve a las otras cuatro con su nombre, y al salir una, las demás se enteran.

### M16 — Identidad y roles

**Qué hace.** La v1 entra por link de invitación y nombre. Los roles son host y espectador: solo el host comitea. Los permisos se resuelven en el relay y en el host, nunca en el cliente.

**Depende de.** M4, M6.
**Trabaja con.** M10, M11, M14, M18.

| Tarea | Detalle |
|-------|---------|
| M16-T1 | Rol en la sesión y su propagación a la interfaz |
| M16-T2 | Las acciones de commit y push solo las acepta el host |
| M16-T3 | Validación en el servidor, con el cliente solo ocultando lo que no puede hacer |
| M16-T4 | El link no sobrevive a la sesión |

**Hecho cuando.** Un espectador no puede commitear ni con la petición hecha a mano.

**Deuda consciente.** No hay autenticación en la v1. Mientras no entre, las salas globales se limitan a repositorios que el equipo acepte exponer con link.

### M17 — Sala global

**Qué hace.** El mismo contenedor host corriendo en un servidor, con el repositorio clonado por identificador. Es el caso de las pizarras de conocimiento compartido, donde nadie tiene que clonar nada.

**Depende de.** M5, M6, M14, M16.
**Trabaja con.** M11, M18.

| Tarea | Detalle |
|-------|---------|
| M17-T1 | Arranque del host en modo global y su registro |
| M17-T2 | Clonado del repositorio por identificador dentro del contenedor |
| M17-T3 | Commit y push desde el servidor |
| M17-T4 | Interruptor nube o local en la interfaz al volverse host |

**Hecho cuando.** Alguien abre una sala global, trabaja, y el commit aparece en el remoto sin que nadie tuviera el repositorio en su máquina.

Es el último módulo de la fase 1: necesita que git y el push ya funcionen en la sala de usuario.

---

## 4. Pizarra y versiones

### M8 — Pizarra

**Qué hace.** El lienzo: formas, selección, cámara, y su conexión al documento compartido de la sala.

**Depende de.** M6, M7.
**Trabaja con.** M9, M10, M18.

| Tarea | Detalle |
|-------|---------|
| M8-T1 | Lienzo montado en la web con la librería de pizarra |
| M8-T2 | Conexión del lienzo al documento de la sala |
| M8-T3 | Dos personas dibujando sin candados ni pisadas |
| M8-T4 | Comportamiento sin red: se sigue dibujando y al volver se fusiona |

**Hecho cuando.** El trazo de una persona aparece en la pantalla de la otra dentro del objetivo de latencia.

### M9 — Traductor

**Qué hace.** Convertir el tablero a un JSON portable, y de vuelta. Ese JSON es lo que se escribe como archivo en el repositorio y lo que git puede revisar. Guardar la pizarra es guardar el estado espacio-temporal de los elementos, no texto suelto.

**Depende de.** M8, M2.
**Trabaja con.** M10, M11, M14.

| Tarea | Detalle |
|-------|---------|
| M9-T1 | Del tablero a JSON: formas, coordenadas, orden |
| M9-T2 | De JSON al tablero, sin pérdida |
| M9-T3 | Versión de formato propia, independiente del formato interno de la librería |
| M9-T4 | Pruebas de ida y vuelta con tableros de ejemplo |

**Hecho cuando.** Un tablero exportado y vuelto a importar es idéntico, y el archivo se entiende en un diff.

**Riesgo.** Si el formato de la librería cambia al actualizar, este módulo absorbe el golpe. Por eso el formato del archivo es nuestro.

### M10 — Staging y commits

**Qué hace.** El control de versiones de la pizarra: marcar en staging lo que entra, guardar como commit con padre y participantes, historial, y checkout de un commit anterior como nuevo estado de trabajo.

**Depende de.** M6, M9, M2, M16.
**Trabaja con.** M11, M18.

| Tarea | Detalle |
|-------|---------|
| M10-T1 | Área de staging en la sala y marcado por los participantes |
| M10-T2 | Commit: snapshot, JSON del tablero, autor, participantes, padre |
| M10-T3 | Historial de la pizarra |
| M10-T4 | Checkout: traer un commit al estado de trabajo sin reescribir historia |
| M10-T5 | Encadenamiento después de un checkout, dejando la puerta abierta a ramificar |

**Hecho cuando.** Se puede guardar, ver el historial, volver a una versión anterior, y seguir trabajando desde ahí.

Ramificación queda **fuera** de la fase 1.

### M18 — Interfaz y sesiones

**Qué hace.** La misma interfaz para todos: volverme host, interruptor nube o local, generar link, unirse, activar y desactivar el modo en línea, varias sesiones a la vez, y los estados del push.

**Depende de.** M3, M7, M10, M16.
**Trabaja con.** M8, M11, M17.

| Tarea | Detalle |
|-------|---------|
| M18-T1 | Acción de volverme host y generación del link |
| M18-T2 | Unirse con link y entrar como espectador |
| M18-T3 | Lista de sesiones y cambio entre ellas |
| M18-T4 | Estados visibles: en línea, reconectando, sala cerrada, push en proceso o fallido |
| M18-T5 | Lectura del markdown publicado y acceso a PDF y Word |

**Hecho cuando.** Alguien que no vio el código puede abrir, invitar, trabajar y publicar sin instrucciones.

Los controles de acceso (quién entra, link privado, contraseña) quedan **fuera** de la fase 1.

---

## 5. Publicación

### M11 — Push

**Qué hace.** La tubería que convierte un commit en documentos: congelar el snapshot, encolar el trabajo, generar, escribir los archivos y dejar el estado replicado para que la interfaz lo vea.

**Depende de.** M10, M3, M2.
**Trabaja con.** M12, M13, M14, M18.

| Tarea | Detalle |
|-------|---------|
| M11-T1 | Cola de trabajos en el host |
| M11-T2 | Orden del push: validar rol, congelar snapshot, encolar |
| M11-T3 | Estados del documento replicados: en proceso, publicado, fallido |
| M11-T4 | Reintento desde la versión, sin volver a dibujar nada |
| M11-T5 | Mecanismo genérico, con markdown, PDF y Word como variantes |

**Hecho cuando.** El push responde de inmediato y la interfaz muestra el avance aunque quien publicó cierre la pestaña.

**Nota de diseño.** M11-T5 importa: cuando entren los módulos de IOKOIA, cada tipo de salida debe ser una variante de esta tubería, no una tubería nueva.

### M12 — Markdown con IA

**Qué hace.** Convertir el contenido de la pizarra en markdown con secciones estables: contexto, decisiones, planes, pendientes.

**Depende de.** M11, M9.
**Trabaja con.** M13, M14, M15.

| Tarea | Detalle |
|-------|---------|
| M12-T1 | Entrada del modelo a partir del snapshot y del JSON del tablero |
| M12-T2 | Secciones fijas y su validación antes de escribir el archivo |
| M12-T3 | Reintento y guardado de la salida cruda cuando no valida |
| M12-T4 | Modelo simulado para las pruebas, sin ramas de simulación en el camino real |

**Bloqueado por un punto abierto.** Qué proveedor de IA se usa y si hace falta un modo sin IA para repositorios sensibles. El contenido de la pizarra sale de la organización en esa llamada. **Hay que decidirlo antes de M12-T1.**

### M13 — Exportación

**Qué hace.** Del mismo markdown a PDF y Word, y el guardado de esos adjuntos.

**Depende de.** M12, M11.
**Trabaja con.** M14, M18.

| Tarea | Detalle |
|-------|---------|
| M13-T1 | Generación de PDF y Word desde el markdown publicado |
| M13-T2 | Adjuntos asociados al commit |
| M13-T3 | Reintento de la exportación sin regenerar el texto |

**Hecho cuando.** Un fallo de la exportación no obliga a volver a pasar por el modelo.

### M14 — Git

**Qué hace.** La copia de trabajo del host: escribir los archivos generados, comitear y empujar al remoto. Es el camino por el que se enteran los que no estuvieron.

**Depende de.** M11, M16.
**Trabaja con.** M9, M12, M13, M15, M17.

| Tarea | Detalle |
|-------|---------|
| M14-T1 | Escritura de los archivos generados en rutas propias y declaradas |
| M14-T2 | Commit con mensaje derivado del commit de la pizarra |
| M14-T3 | Push al remoto |
| M14-T4 | Remoto adelantado: traer, reintentar, y resolución para archivos generados |
| M14-T5 | No mezclar lo generado con la documentación escrita a mano |

**Punto abierto.** En la junta quedó como posible recorte del alcance inicial. **Hay que decidirlo antes de M14-T1**, porque M15 y M17 dependen de esta decisión.

### M15 — CLI `space`

**Qué hace.** El binario de la máquina del developer: arrancar el host para un checkout, reportar estado, y materializar el markdown publicado en el repositorio.

**Depende de.** M3, M2, M14.
**Trabaja con.** M4, M11.

| Tarea | Detalle |
|-------|---------|
| M15-T1 | `space host`: levanta el contenedor host para este checkout y devuelve el link |
| M15-T2 | `space status`: versión local y si la réplica está al día |
| M15-T3 | `space update`: baja las versiones y escribe los archivos |
| M15-T4 | Idempotencia: no reescribir si el contenido es idéntico |
| M15-T5 | Mensajes cortos con sala, versión y ruta escrita |

**Hecho cuando.** Alguien que no estuvo en la sesión corre un comando y tiene el markdown en su repositorio.

**Punto abierto.** Si el CLI de la v1 debe poder unirse a una sala o solo materializar y reportar.

---

## 6. Orden de construcción

Sigue el orden del análisis de arquitectura: primero la promesa que distingue al producto, después la pizarra.

| Hito | Módulos | Se demuestra con |
|------|---------|------------------|
| **H1 Cimientos** | M1, M2 | Las dos máquinas levantan el motor; el contrato de datos está cerrado |
| **H2 El documento viaja** | M3, M15, M14 | Un markdown de prueba sale de un host y aparece en el repositorio de la otra persona |
| **H3 Hay sala** | M4, M5, M6, M7, M16 | Alguien en otra red entra por link y se ve la presencia |
| **H4 Hay pizarra** | M8, M9, M18 | Dos personas dibujan a la vez y el tablero se guarda como archivo |
| **H5 Hay versiones** | M10 | Staging, commit, historial y checkout |
| **H6 Hay publicación** | M11, M12, M13 | Un commit se convierte en markdown, PDF y Word |
| **H7 Sala global** | M17 | Una pizarra en servidor comitea sin que nadie clone el repositorio |

M19 y M20 avanzan dentro de cada hito, no al final.

---

## 7. Reparto propuesto

Dos pistas que se tocan lo menos posible, para no bloquearse. **M2 se hace entre los dos antes de separar**: es el contrato que las dos pistas comparten, y cambiarlo después es lo más caro del proyecto.

| Pista | Módulos | Carácter del trabajo |
|-------|---------|----------------------|
| **A — Datos, host y publicación** | M3, M11, M12, M13, M14, M15, M17 | Base local y réplica, cola de trabajos, modelo, exportación, git, CLI |
| **B — Conexión, pizarra e interfaz** | M4, M5, M6, M7, M8, M9, M10, M16, M18 | Orquestador, relay, sala en vivo, presencia, lienzo, versionado, interfaz |
| **Compartidos** | M1, M2, M19, M20 | Los dos. M2 primero y juntos |

Propuesta de asignación, a ajustar entre ustedes:

- **David:** pista A. Es la que conecta con el CLI, git y la forma de trabajar de IOKOIA, que es donde ya tiene contexto.
- **Kua:** pista B. Es la separación orquestador y host, y el versionado de la pizarra, que fue lo que propuso en la junta.

### Puntos de contacto

Donde las dos pistas se encuentran, conviene acordarlo antes de codear:

| Contacto | Entre | Qué hay que acordar |
|----------|-------|---------------------|
| Snapshot del commit | M10 (B) y M11 (A) | Qué recibe exactamente la tubería de publicación |
| JSON del tablero | M9 (B) y M14 (A) | Qué archivo se escribe y en qué ruta |
| Réplica por el relay | M3 (A) y M5 (B) | Cómo pasa la réplica por el relay sin mezclarse con la sesión |
| Estados del push | M11 (A) y M18 (B) | Qué estados ve la interfaz y cómo llegan |
| Rol del host | M16 (B) y M14 (A) | Quién valida que solo el host comitea |

### Arranque sugerido

| Semana | Pista A | Pista B |
|--------|---------|---------|
| 1 | M2 juntos, luego M1 en las dos máquinas | M2 juntos, luego M1 |
| 2 | M3: base local y los tres puntos de réplica | M4 y M5: registro, link y relay |
| 3 | M15: CLI con `update` idempotente | M6 y M7: sala en vivo y presencia |
| 4 | M14: copia de trabajo, commit y push | M8: lienzo conectado a la sala |

Al final de la semana 4, H2 y H3 deberían estar demostrables. De ahí en adelante se replanifica con lo aprendido.

---

## 8. Lo que bloquea

Tres decisiones de producto detienen módulos concretos. No se resuelven implementando.

| Punto abierto | Bloquea | Hasta cuándo se puede esperar |
|---------------|---------|-------------------------------|
| Proveedor de IA y si hace falta un modo sin IA | M12 | Antes del hito H6 |
| Si git entra en el alcance inicial | M14, y con él M15 y M17 | Antes del hito H2 |
| Alcance del CLI en la v1 | M15 | Antes del hito H2 |
| Qué parte del tablero entra en staging | M10 | Antes del hito H5 |
| Cuándo entra autenticación | M17 con repositorios reales | Antes de abrir la primera sala global con un repositorio del equipo |

Las dos primeras son urgentes: H2 es el primer hito con valor demostrable y las dos lo tocan.

---

## 9. Fuera de la fase 1

- Migración de host cuando el host cae.
- Ramificación del historial de la pizarra.
- Control de acceso, link privado, contraseña.
- Maestro central en la nube.
- Markdown en tiempo real mientras se dibuja.
- Los módulos de IOKOIA Space (diseño, git, tareas, minutas, calendario, correo, agentes, depuración, metas, procedimientos, entidades, autenticación).
- Aplicación móvil.

Cada uno de esos módulos de IOKOIA, cuando llegue, entra como colecciones, pantallas y comandos de este motor, reutilizando la tubería de M11 y el contrato de M2.
