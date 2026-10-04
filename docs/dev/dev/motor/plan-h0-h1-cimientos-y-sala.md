# Plan de acción — H0 Cimientos y H1 Sala por link

Rama: `dev/motor`. Contexto, decisiones y riesgos: [analisis-h0-h1-cimientos-y-sala.md](./analisis-h0-h1-cimientos-y-sala.md).

Quince pasos en dos fases. Cada paso se puede verificar por sí solo; ninguno depende de que el siguiente funcione para saber si quedó bien.

## Reglas de trabajo de esta rama

1. **Un paso, un conjunto de cambios.** No se mezclan pasos en el mismo commit.
2. **Ningún paso se da por terminado sin su verificación corriendo.** "Compila" no es verificación.
3. **Las decisiones abiertas del análisis se confirman antes del paso que las necesita**, no durante.
4. **Si un paso descubre que el diseño no define algo, se detiene** y se anota en el análisis. No se rellena el hueco suponiendo.
5. Nada de esta rama toca pizarra, commits, publicación ni autenticación.

## Mapa

```text
FASE A — H0 Cimientos
  A1 rama y documentación
  A2 arranque en las dos máquinas
  A3 humo de WebSocket por el proxy        ← mata el riesgo R1 antes de construir
  A4 andamio de pruebas
  A5 reglas del contrato
  A6 formato de log
                 │
                 ▼  checkpoint: H0 cerrada
FASE B — H1 Sala por link
  B1 contrato del protocolo
  B2 registro de salas
  B3 túnel del orquestador                 ← momento de la verdad: NAT real
                 │
                 ▼  checkpoint: el túnel cruza
  B4 conexión del host
  B5 sala en vivo y presencia
  B6 web: nombre, volverme host, unirme
                 │
                 ▼  checkpoint: demostración entre las dos máquinas
  B7 resistencia y reconexión
  B8 roles mínimos
  B9 pruebas de varios participantes y cierre
```

---

# Fase A — H0 Cimientos

## A1 — Rama y documentación

**Objetivo.** Que exista el lugar donde vive el trabajo de esta rebanada.

**Archivos.** `docs/dev/dev/motor/README.md`, `analisis-*.md`, `plan-*.md`.

**Verificación.** `git branch --show-current` devuelve `dev/motor` y la carpeta tiene los mismos segmentos.

**Hecho cuando.** Los tres archivos existen y el análisis lista las decisiones abiertas.

## A2 — Arranque en las dos máquinas

**Objetivo.** Que las dos personas levanten el motor igual. Un entorno distinto por persona es una fuente de bugs falsos que cuesta días.

**Archivos.** Ninguno de código. Si algo falla, se corrige donde falle y se anota.

**Verificación.** En cada máquina: `pnpm install`, `pnpm dev`, abrir las tres URLs, `pnpm dev:stop`, y confirmar que `dev:status` las reporta apagadas.

**Hecho cuando.**
1. Las tres URLs responden en las dos máquinas.
2. `pnpm dev:stop` apaga de verdad; cerrar la terminal no deja procesos vivos.
3. Las dos máquinas tienen Node ≥ 23.6 y el proxy de desarrollo instalado.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El proxy se instaló como administrador y el estado no es escribible por el usuario | Se verifica la escritura en el archivo de rutas del proxy antes de seguir |
| Versiones de Node distintas entre las dos máquinas | Se fija y se anota la versión mínima en el README de la rama |
| Un PM2 por usuario distinto del que arranca | Un solo PM2, el de la raíz del repositorio |

## A3 — Humo de WebSocket por el proxy

**Objetivo.** Confirmar que una conexión WebSocket sobrevive al proxy de desarrollo **antes** de construir el relay encima. Es el riesgo R1 y se mata en el primer día, no en el séptimo.

**Archivos.** Un eco temporal en el orquestador y un cliente de prueba. Se retira o se convierte en prueba automatizada en A4.

**Verificación.** Un cliente se conecta a la URL pública del orquestador, manda un mensaje binario y recibe el mismo de vuelta. Se prueba también desde el navegador, para incluir el camino con TLS.

**Hecho cuando.**
1. El eco funciona por la URL pública, no solo contra el puerto local.
2. Mensajes binarios vuelven idénticos, byte por byte.
3. Una conexión abierta sobrevive más de un minuto sin que el proxy la corte.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El proxy corta conexiones inactivas y lo confundimos con un bug nuestro | Se mide el tiempo de corte y se fija el intervalo de latido por debajo |
| Funciona en local y falla por TLS | La prueba se hace por la URL pública desde el principio |
| El recargado en caliente de la web rompe la conexión y parece fallo del relay | Se prueba primero con un cliente fuera del navegador |

## A4 — Andamio de pruebas

**Objetivo.** Que `pnpm test` ejecute pruebas reales y que esté decidido dónde vive cada tipo.

**Archivos.** Configuración del runner elegido (decisión **D8**) y la primera prueba real.

**Decisión que se cierra aquí.** Dónde viven las pruebas que cruzan procesos. Las unitarias van junto a su dueño, en la misma carpeta del código que prueban. Las que levantan orquestador y host a la vez necesitan un lugar propio, porque no tienen un único dueño.

**Hecho cuando.**
1. `pnpm test` corre en la raíz y en cada paquete.
2. Hay al menos una prueba unitaria real y una que levanta dos procesos.
3. Está escrito en el README de la rama dónde va cada tipo de prueba.

| Error previsto | Cómo se evita |
|----------------|---------------|
| Pruebas que dependen del orden en que corren | Cada prueba levanta y tumba lo suyo |
| Puertos fijos en las pruebas y choques entre corridas | Puerto cero y lectura del puerto asignado |
| Pruebas que se quedan colgadas y bloquean la corrida | Tiempo máximo explícito en todas las que abren sockets |

## A5 — Reglas del contrato

**Objetivo.** Las reglas que el contrato de datos va a seguir siempre. **No** los campos de cada colección: esos se cierran en la épica que los usa.

**Archivos.** `packages/domain/src/` y `packages/schema/src/`, una carpeta por concepto.

Qué se fija:

| Regla | Contenido |
|-------|-----------|
| Identificadores | Cómo se generan, qué longitud, qué alfabeto, cómo se validan |
| Versión de esquema | Dónde se declara y cómo se migra |
| Orden | Cómo se ordenan los registros para replicar, sin depender del reloj del cliente |
| Borrado | Lógico, con marca; nunca físico en lo replicado |
| Estilo | Uniones de literales y tipos planos. **Sin `enum`, sin `namespace`, sin propiedades declaradas en el constructor, sin decoradores** |

Esa última fila no es gusto: Node ejecuta TypeScript **quitando** los tipos, no transformándolos, así que esas construcciones fallan en ejecución aunque compilen.

**Hecho cuando.**
1. Hay pruebas del generador de identificadores y del validador.
2. Las dos personas leyeron las reglas y están de acuerdo.
3. Ningún archivo nuevo usa las construcciones prohibidas.

## A6 — Formato de log

**Objetivo.** Que un fallo se pueda seguir entre los tres procesos.

**Hecho cuando.** Cada línea de log lleva proceso, identificador de sala cuando aplica, y un mensaje en una sola línea. Se puede seguir una sala completa filtrando por su identificador.

> **Checkpoint 1.** H0 cerrada: las dos máquinas levantan el motor, las pruebas corren, el WebSocket cruza el proxy y el contrato tiene reglas. **Antes de seguir, confirmar las decisiones D3, D1, D4 y D5.**

---

# Fase B — H1 Sala por link

## B1 — Contrato del protocolo

**Objetivo.** Los tipos que orquestador, host y web comparten. Es el único lugar donde se define el protocolo.

**Archivos.** `packages/domain/src/relay/` y `packages/domain/src/sala/`.

Qué incluye: identificador de sala y de conexión, token de host y token de invitación, el conjunto de **canales** como unión de literales, y los mensajes de control (registro, registro aceptado, registro rechazado con causa, entra invitado, sale invitado, sala cerrada).

**Restricción de diseño.** El contrato es genérico. Ninguna palabra de pizarra aparece aquí: el canal de hoy es el de sesión, y mañana habrá uno de réplica. Agregar ese canal debe ser un miembro más de la unión y su manejador en el host, nada más.

**Verificación.** Pruebas de serialización y de rechazo de mensajes mal formados.

**Hecho cuando.**
1. Los tres procesos compilan contra el mismo contrato.
2. Un mensaje desconocido o con un canal inválido se rechaza con causa, no se ignora en silencio.
3. Un canal nuevo hipotético se agrega en el contrato sin tocar el orquestador.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El contrato se escribe dentro del orquestador y el host lo duplica | Vive en `packages/domain`; los procesos solo lo importan |
| Mensajes de control y datos mezclados sin distinguir | Canal explícito en todos |
| Envolver binario en texto y pagar un tercio más de tamaño | El transporte es binario |

## B2 — Registro de salas

**Objetivo.** El orquestador sabe qué salas hay y cómo alcanzar a cada host. En memoria, sin base de datos.

**Archivos.** `apps/orchestrator/src/registro-de-salas/` con su prueba al lado.

Qué hace: alta con token de host, baja al cerrar, resolución por identificador, latido con corte por inactividad, y reemplazo del registro cuando el **mismo** host vuelve (decisión **D5**).

**Verificación.** Pruebas unitarias sin red: alta, baja, duplicado de otro host rechazado con causa, mismo host reemplazando, expiración por falta de latido.

**Hecho cuando.**
1. Un host distinto que reclama una sala ocupada recibe un rechazo con causa clara.
2. El mismo host, con su token, recupera su sala de inmediato.
3. Una sala sin latido desaparece y el contador de salas vivas vuelve a cero.

| Error previsto | Cómo se evita |
|----------------|---------------|
| Salas fantasma que nunca se limpian | Latido obligatorio y prueba que verifica el contador en cero |
| El mismo host bloqueado por su propio registro viejo | Token de host y reemplazo |
| Identificadores adivinables | Longitud y alfabeto fijados en A5, con prueba |

## B3 — Túnel del orquestador

**Objetivo.** Que los bytes de un invitado lleguen al host y de vuelta. Es el corazón de la épica.

**Archivos.** `apps/orchestrator/src/tunel/`.

Qué hace, con la forma elegida en **D3**: el host mantiene una conexión de control; cuando entra un invitado, el orquestador valida el token, avisa al host, el host abre una conexión de datos saliente para ese invitado, y el orquestador une las dos puntas y deja de interpretar lo que pasa.

**Verificación.**
- Prueba automatizada de eco: invitado y host simulados, mensajes binarios de ida y vuelta.
- Varias conexiones a la vez sin que se crucen los mensajes.
- **Prueba manual con dos redes distintas**, no con dos pestañas.

**Hecho cuando.**
1. Un cliente en otra red intercambia bytes con un host detrás de NAT.
2. Con diez invitados, ningún mensaje llega a quien no era.
3. Cerrar un invitado cierra su conexión de datos y libera memoria.
4. El orquestador no inspecciona el contenido: funciona con cualquier carga binaria.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El host tarda en abrir la conexión de datos y el invitado cree que falló | Tiempo máximo explícito y mensaje de causa al invitado |
| Mensajes cruzados entre invitados | Identificador de conexión en la unión de puntas, con prueba de diez a la vez |
| Un invitado lento llena la memoria del orquestador | Límite de cola por conexión; se cierra a quien no drena |
| Conexiones de datos huérfanas si el invitado se va antes de unirse | Tiempo máximo de emparejamiento y barrido |
| Mensajes enormes | Límite de tamaño configurado y probado |

> **Checkpoint 2.** El túnel cruza NAT. Si algo de la arquitectura iba a fallar, falla aquí. **No se sigue sin esta prueba hecha entre dos redes.**

## B4 — Conexión del host

**Objetivo.** Que el contenedor host se registre solo y se mantenga registrado.

**Archivos.** `apps/host/src/conexion-al-orquestador/`.

Qué hace: abre la conexión de control al arrancar, se registra con su token, responde el latido, atiende el aviso de invitado abriendo la conexión de datos, y reconecta con espera creciente si se cae.

**Verificación.** Arrancar el host antes que el orquestador; matar el orquestador en media sesión; suspender y despertar la máquina.

**Hecho cuando.**
1. El host arranca sin el orquestador arriba y se registra solo cuando aparece.
2. Matar y levantar el orquestador vuelve a dejar la sala registrada sin tocar el host.
3. La espera entre reintentos crece y tiene tope.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El host muere si el orquestador no está | Reintento desde el arranque, nunca salir con error |
| Tormenta de reconexión | Espera creciente con variación aleatoria y tope |
| Dos conexiones de control del mismo host tras una reconexión sucia | Token de host y cierre de la anterior |
| Reintentar para siempre un rechazo definitivo | Se distingue rechazo definitivo de fallo temporal: el definitivo no se reintenta |

## B5 — Sala en vivo y presencia

**Objetivo.** Un documento compartido vivo en el host, con la lista de participantes.

**Archivos.** `apps/host/src/sala/`, `apps/host/src/participantes/` y `packages/cliente-del-relay/` (lado invitado del túnel, decidido al aterrizar D2).

Qué hace, con la decisión **D2**: se monta el servidor de sala real y la presencia usa su mecanismo propio, no uno inventado. Cada conexión de datos del túnel entra como un cliente normal.

**Sin persistencia todavía:** si el host reinicia, la sala arranca vacía. Eso es H3.

**Verificación.** Dos clientes sin navegador se conectan, se ven en la presencia, uno se desconecta y desaparece del otro.

**Hecho cuando.**
1. Dos clientes comparten estado y presencia a través del túnel.
2. Al cerrar sucio un cliente, desaparece de la lista por tiempo de espera, sin quedar fantasma.
3. Nada del código del túnel conoce el formato de lo que transporta.

| Error previsto | Cómo se evita |
|----------------|---------------|
| Participantes fantasma tras un cierre sucio | Tiempo de espera de presencia, con prueba |
| La presencia se construye a mano y se tira en H2 | Decisión D2: se usa el mecanismo de la sala |
| Suponer la forma de la API del servidor de sala | Se consulta su documentación oficial antes de escribir el paso |

## B6 — Web: nombre, volverme host, unirme

**Objetivo.** Las pantallas mínimas para que esto sea usable por una persona.

**Archivos.** `apps/web/src/entrada/`, `apps/web/src/host/`, `apps/web/src/sala/`, y `apps/host/src/invitacion/` (el host entrega su invitación a la web de su máquina, decidido al aterrizar D7).

Qué hace: pedir el nombre y recordarlo, acción de volverme host que devuelve el link, copiar el link, entrar por link, y la lista de participantes con su rol.

**Hecho cuando.**
1. Una persona que no vio el código abre, invita y la otra entra.
2. El nombre se recuerda la segunda vez.
3. Un link inválido o de una sala cerrada muestra un mensaje que dice qué pasó.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El token del link queda en el historial y en los registros del servidor | Va en el fragmento de la URL, después de `#` |
| Dos pestañas de la misma persona se cuentan como dos participantes | Identificador de sesión por pestaña y nombre visible; se acepta y se muestra tal cual |
| Estado de conexión invisible y el usuario cree que se colgó | Indicador de conectado, reconectando y sala cerrada desde este paso |

> **Checkpoint 3.** Demostración entre las dos máquinas, en redes distintas. Es la primera vez que H1 se ve como funcionalidad.

## B7 — Resistencia y reconexión

**Objetivo.** Que las caídas no se vean como bugs aleatorios.

Qué entra: espera creciente con variación en host y en web, límites de cola y de tamaño de mensaje, cierre limpio en los tres procesos, y mensajes de error con causa en lugar de fallos de red genéricos.

**Verificación.** Matar el orquestador, matar el host, partir la red del invitado, inyectar latencia.

**Hecho cuando.**
1. Después de cada caída, el sistema vuelve solo, sin recargar la página.
2. Ningún caso termina en un error genérico sin causa.
3. No hay crecimiento de memoria tras cien ciclos de conexión y desconexión.

## B8 — Roles mínimos

**Objetivo.** Host y espectador, resueltos donde no se pueden falsificar.

**Hecho cuando.**
1. El rol lo determina el servidor, no el cliente.
2. Una acción de host enviada a mano por un espectador se rechaza.
3. La interfaz oculta lo que el rol no permite, pero ocultar no es el control.

| Error previsto | Cómo se evita |
|----------------|---------------|
| Validar el rol solo en la interfaz | Prueba que envía la petición saltándose la interfaz |
| Que el rol viaje en el mensaje del cliente | El rol se deriva del token con el que se registró la conexión |

## B9 — Varios participantes y cierre

**Objetivo.** La prueba que no se puede saltar.

Qué entra: arnés de 2 a 10 clientes sin navegador sobre la misma sala, entradas y salidas durante la sesión, y la medición de cuánto tarda un mensaje en cruzar el relay.

**Hecho cuando.**
1. Diez clientes convergen al mismo estado.
2. La lista de participantes refleja el número real en todo momento.
3. La medición de latencia queda registrada como punto de partida para H2.
4. La prueba corre en la máquina de cualquiera de los dos.

> **Checkpoint 4.** H1 cerrada. Se revisa el bloque de mecanismo del análisis: si alguna palabra de pizarra se coló en el orquestador o en el contrato del relay, se corrige antes de cerrar la rama.

---

## Definition of done de la rama

H0 y H1 están terminadas cuando:

| # | Criterio | Cómo se comprueba |
|---|----------|-------------------|
| 1 | Las dos personas levantan y apagan el motor | En las dos máquinas |
| 2 | `pnpm typecheck` y `pnpm test` pasan, con pruebas reales | En la raíz |
| 3 | Alguien en otra red entra por el link sin configurar nada | Prueba manual con dos redes |
| 4 | Los participantes se ven con nombre y desaparecen al salir | Prueba automatizada y manual |
| 5 | Matar el orquestador no obliga a recargar | Prueba de resistencia |
| 6 | Apagar el host muestra "sala cerrada", no un error de red | Prueba manual |
| 7 | Un espectador no puede ejecutar acciones de host ni a mano | Prueba automatizada |
| 8 | Diez participantes a la vez, convergiendo | Arnés de B9 |
| 9 | Sin fugas tras cien ciclos de conexión | Prueba de B7 |
| 10 | El orquestador no conoce el contenido que transporta | Revisión del checkpoint 4 |

## Qué queda montado para después

Al cerrar esta rama quedan pendientes, a propósito: la sala no persiste (H3), no hay lienzo (H2), no hay commits (H4), y no hay autenticación. Nada de eso es un fallo de esta rebanada; está declarado fuera de alcance en el análisis.

## Plan de pruebas consolidado

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| Unitarias | Identificadores, tokens, registro de salas, serialización del contrato, espera creciente | Junto al código que prueban |
| Integración | Host, orquestador y clientes sin navegador en la misma sala | Lugar decidido en A4 |
| Varios participantes | De 2 a 10 clientes, entradas y salidas, convergencia, presencia | Arnés de B9 |
| Resistencia | Matar procesos, partir la red, latencia, ciclos de conexión | Con los contenedores |
| Manual | Dos redes distintas; recorrido completo de invitar y entrar | Las dos máquinas |
