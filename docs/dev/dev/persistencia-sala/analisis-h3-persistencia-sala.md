# Análisis — H3 La sala sobrevive

Rama: `dev/persistencia-sala`.  
Plan: [plan-h3-persistencia-sala.md](./plan-h3-persistencia-sala.md).

## 1. Por qué esta rebanada ahora

H0 y H1 dejaron la sala alcanzable detrás de NAT. H2 dejó a dos personas dibujando sobre el documento Yjs de esa sala, con el log del invitado en IndexedDB. Lo que falta para que el producto sea usable es lo que la fase 1 pone en H3 y no al final: si el host suspende la laptop o el proceso muere, el trabajo no puede desaparecer.

Historia de producto (fase 1, sección 6):

> Mi máquina se suspende o el relay se cae, y cuando vuelvo la sala sigue siendo la misma.

Hoy no es así. `apps/host/src/main.ts` llama a `generarIdentidadDeSala()` en cada arranque. El comentario de ese archivo y el de `apps/host/src/sala/sala.ts` dicen que la sala vive en memoria y que la persistencia es H3. Reiniciar el host crea otro identificador, otro link y un documento vacío.

## 2. Qué ya existe (no se reconstruye)

| Pieza | Dónde | Qué hace hoy |
|-------|-------|----------------|
| Identidad de sala | `packages/domain/src/sala/identidad-de-sala/` | Cuatro valores: `sala`, `tokenDeHost`, `tokenDeInvitacion`, `tokenDeWebDelHost`. D4 separa el identificador (no es secreto) de los tokens. D5: el mismo `tokenDeHost` recupera el registro en el orquestador |
| Rotación del link | `rotarTokenDeInvitacion` | Cambia solo el token de invitación. La sala y el token de host siguen |
| Sala Yjs | `apps/host/src/sala/sala.ts` | Hocuspocus 4 sin servidor propio. Un documento, con el nombre de la sala. Otro nombre se rechaza en `onConnect`. Conexión directa del host para que el documento no se descargue al irse el último invitado. Espera de conexión: 30 s |
| Registro y relay | Orquestador, en memoria | No persiste. Si el orquestador reinicia, el host vuelve a registrarse. M4 sigue sin base de datos en H3 (entra ◐: el host reaparece con la misma identidad) |
| Cierre avisado | `apagar` en `main.ts` + `cerrar-sala` | SIGTERM anuncia `host-cerro-la-sala`. Ese cierre es definitivo para quien escucha (`esCierreDefinitivo`) |
| Muerte súbita | Prueba de resistencia | SIGKILL no manda `cerrar-sala`. El invitado ve una caída y el proveedor reintenta |
| Espera al host | `apps/web/src/sala/conexion-a-la-sala/` | Rechazo temporal después de haber entrado: «Esperando al host…», sin tope. Al volver el host, entra sola. Un cierre definitivo sigue parando |
| Log del invitado | `apps/web/src/sala/log-local/` | `y-indexeddb`, una base por sala. H2. No restaura el host |
| Lienzo | `apps/web/src/sala/lienzo/` | Escribe el tablero en el `Y.Map` `tablero` del documento. La presencia (nombre, cursor, selección) va en awareness |
| Resistencia | `packages/pruebas-entre-procesos/src/resistencia/` | Matar orquestador, SIGTERM y SIGKILL del host, red partida, corte y latencia. El proveedor no se recarga |

## 3. Qué entra y qué no

**Entra (H3-T1…T7):**

1. El documento de la sesión queda en disco en el host.
2. Al rearrancar, la sala vuelve en el último estado de ese documento.
3. Compactación del documento (el alcance exacto está en E3).
4. Quien sigue en la página se reconecta al volver el host, sin recargar.
5. Quien dibujó sin red se fusiona cuando la sala restaurada vuelve a estar abierta.
6. Estados visibles de en línea, reconexión y sala cerrada, con causa.
7. Pruebas de resistencia: matar procesos, partir la red, inyectar latencia.

**No entra:**

| Tema | Por qué |
|------|---------|
| Staging, commit, historial, checkout, traductor a JSON | H4. El «último estado» de H3 es el documento vivo, no un commit: los commits no existen |
| Réplica central, PowerSync, backend de escritura | Antes de H4. La referencia Space dice que el documento Yjs de H3 es otro almacén y no se mezcla con el espejo |
| El orquestador guarda salas | M4 no persiste. El directorio es de lo que está vivo ahora |
| Push, CLI, git | H5 |
| IA, PDF, Word | H6 |
| Sala global, host en servidor | H7 |
| Migración de host | Fuera de la v1. Si este host no vuelve, la sala no revive en otra máquina |
| Autenticación, link privado, contraseña | Después |
| Construir la app Expo | El diseño está en H2. Las pantallas de H3 siguen en `apps/web` |
| Teléfono como host local | Fuera de la v1 |

## 4. Decisiones ya tomadas (no se reabren aquí)

| Decisión | Dónde quedó |
|----------|-------------|
| El host es el dueño del documento de la sesión | Arquitectura v2, topología host-autoritativa |
| El tablero en vivo es un documento Yjs, binario, en SQLite, en el contenedor host | Arquitectura v2, sección 5 |
| Al volver a arrancar se restaura el último estado del documento, no un commit | Arquitectura v2, sección 10; fase 1, definition of done de H3 |
| El formato guardado es el binario de Yjs (`Uint8Array`). Reconstruir el documento desde JSON duplica contenido al reconectar | [Persistencia de Hocuspocus](https://tiptap.dev/docs/hocuspocus/guides/persistence) |
| Hocuspocus 4 ya está en el host (`@hocuspocus/server` y `@hocuspocus/provider` ^4.7.0). Su extensión de SQLite usa `better-sqlite3` desde la v4 | Análisis H0/H1, nota de B5; [extensión SQLite](https://tiptap.dev/docs/hocuspocus/server/extensions/sqlite) |
| `onStoreDocument` va con debounce. Si el hook falla, el documento sigue en memoria y se reintenta. `destroy()` vacía los guardados pendientes | [Hooks de Hocuspocus](https://tiptap.dev/docs/hocuspocus/server/hooks). Valores de fábrica: `debounce` 2 s, `maxDebounce` 10 s |
| El relay no mira el documento. El orquestador no conoce Yjs ni Hocuspocus | Checkpoint 4 de H1; se mantiene |
| La conexión directa del host se queda | Sin ella, Hocuspocus descarga el documento cuando se va el último invitado, con el proceso todavía vivo |
| Un solo documento, nombrado con el identificador de sala | `sala.ts`, `onConnect` |
| El mismo `tokenDeHost` reemplaza el registro anterior (D5) | Análisis H0/H1. H3 lo necesita de verdad: si el token cambia en cada arranque, D5 no puede devolver la misma sala |
| El link vigente es `https://<web>/s/<identificador>#<token>` | D7. «La sala sigue siendo la misma» implica el mismo identificador y el mismo token de invitación vigente. Si alguno cambia, el link que ya se compartió deja de abrir esa sala |
| Quien editó sin red fusiona desde el log Yjs del navegador | Arquitectura v2, sección 10. El log ya está (H2) |
| Escrituras de SQLite serializadas. Un escritor: el proceso host | Arquitectura v2, sección 10 |
| Sin fallback que invente una sala nueva si el almacén no se puede leer | Regla del repo: sin fallback. Además el definition of done de H3 prohíbe perder datos sin aviso |
| La demostración entre dos redes de H1/H2 queda como checklist residual | No reabre esas épicas y no bloquea H3 |

## 5. Tensiones entre documentos

Hay que dejarlas escritas. No se resuelven editando `docs/fijos/` en esta rama hasta que el paso de código que las toca esté estable y se pida alinearlos.

**El link y la sesión.** La sección 10 del análisis v2, en seguridad, decía que la sala muere con el host y que el link no sobrevive a la sesión. Eso describía el host de H1. Quedó alineado el 2026-11-12: el link sobrevive en el disco de este host. Un cierre pedido (`host-cerro-la-sala`) sigue siendo definitivo para quien está en la página. Cuando ese host arranca de nuevo, el mismo link vuelve a abrir la sala restaurada. La sala no migra a otra máquina.

**Cuándo se compacta.** Cerrado en E3 el 2026-11-12. H3-T3 queda cubierto por el estado codificado que ya guarda la extensión de SQLite. Compactar al commitear, guardando el estado y no el historial de deltas, es H4.

## 6. Mecanismo

```text
Mecanismo de la capacidad: guardar en el disco del host el documento vivo de la
  sala y su identidad, y volver a abrir esa misma sala al arrancar el proceso
Variantes de hoy: el documento Yjs de la sala (el tablero vive dentro, en el
  mapa `tablero`)
Variantes probables siguientes: otro fragmento en el mismo documento (notas,
  marco) sin un segundo archivo ni un segundo identificador de sala
Módulo dueño: M6 Sala en vivo. La identidad durable es de la sala, no del lienzo
Plugins: la extensión de persistencia del documento; el almacén de la identidad
  (E1). M8 solo escribe en el documento. M5 solo reabre el túnel
Prueba de extensión: otro contenido en el mismo Y.Doc se restaura sin un store
  nuevo, sin un método nuevo en el relay y sin un campo nuevo en el contrato
  del orquestador
Patrón existente a extender: Hocuspocus en `apps/host/src/sala/`; identidad en
  `packages/domain/src/sala/identidad-de-sala/`; log del invitado en
  `apps/web/src/sala/log-local/`
```

Prohibido en H3: persistir «el tablero» como tubería aparte del documento de la sala; meter el binario o los tokens en el orquestador; mezclar este SQLite con el de PowerSync; guardar el `Y.Doc` como JSON.

## 7. Qué tiene que sobrevivir al reinicio

| Dato | ¿Se restaura? | Dónde puede vivir |
|------|----------------|-------------------|
| Identificador de sala | Sí | Disco del host. Es la clave del documento |
| `tokenDeHost` | Sí | Disco del host. Sin él, D5 no recupera el registro. No viaja en el documento Yjs: ese documento lo reciben los invitados |
| `tokenDeInvitacion` vigente | Sí, incluido después de rotarlo | Igual. Si se restaura el token anterior, los links nuevos dejan de servir y los viejos vuelven a servir |
| `tokenDeWebDelHost` | Sí | Igual. Si cambia, la pestaña que era host pasa a espectador |
| Estado Yjs del documento, incluido el mapa `tablero` | Sí | SQLite de la extensión, binario, nombre = identificador de sala |
| Awareness (nombre, cursor, selección, rol sellado) | No como gente todavía presente | Es de la conexión. Al restaurar, la presencia nace vacía y se vuelve a anunciar al reconectar |
| Registro del orquestador | No | Se vuelve a crear cuando el host presenta el mismo `tokenDeHost` |
| Log IndexedDB del invitado | Ya está en el navegador | No se copia al host. Sirve para fusionar |
| Commits, réplica, markdown | No existen todavía | H4 y siguientes |

El directorio, el nombre del archivo y si la identidad va en otra tabla, en otro archivo o en un almacén de secretos son E1. Restricciones que E1 no puede saltarse:

- El archivo no va en el repositorio git.
- No es la base de PowerSync ni el espejo de un cliente.
- `:memory:` no cumple H3: la extensión, sin nombre de archivo, borra todo al cerrar el handle.
- Los tres tokens no van dentro del `Y.Doc`.
- La referencia Space trata los secretos como valores que no se guardan en claro en una columna SQLite. Los tokens de esta sala dan el rol de host y la recuperación del registro. E1 tiene que decir si entran en esa regla. El paquete de secretos de HaruKoia no existe; traerlo entero no es una tarea de H3 salvo que E1 lo elija.

## 8. Flujos

**Primera vez, disco vacío.** Se genera una identidad, se escribe en el almacén y solo entonces el host se registra. Si el proceso muere entre generar y escribir, el siguiente arranque no puede heredar un link que nadie llegó a ver. Si se registra antes de escribir y muere, el siguiente arranque generaría otra sala y el registro viejo quedaría fantasma hasta el latido. El orden es: escribir identidad, luego registrar.

**Se dibuja.** El documento cambia en memoria. `onStoreDocument` persiste el binario con el debounce que fije E2. `sala.cerrar()` tiene que vaciar lo pendiente, que es lo que hace `destroy()` en Hocuspocus 4.

**SIGKILL o se corta la luz.** No hay `cerrar-sala`. En disco queda el último guardado que alcanzó a entrar. Lo que solo vivía dentro de la ventana de debounce no está. E2 decide si esa ventana se acepta y cómo se entera alguien, porque el definition of done dice que un dato perdido no puede ser silencioso. Al arrancar de nuevo: se lee la identidad, se carga el documento por su nombre, se mantiene la conexión directa, se registra con el mismo `tokenDeHost`. Quien sigue en la página reintenta el mismo link.

**SIGTERM (`apagar`).** Sigue anunciando `host-cerro-la-sala` antes de salir. El invitado no reintenta solo: el cierre es definitivo, igual que la prueba de resistencia actual. El guardado pendiente se vacía al cerrar. El siguiente arranque restaura esa sala. Quien quiera entrar abre de nuevo el mismo link.

**El orquestador muere.** Ya está probado: el documento sigue en el host y, al volver el orquestador, el host se registra. H3 añade que ese documento también está en disco por si el host muere en el mismo intervalo. El orquestador no gana una base de datos.

**Invitado sin red mientras el host reinicia.** Sus updates quedan en su `Y.Doc` (y en IndexedDB si recarga la página). Al reconectar contra el documento restaurado, Yjs fusiona. El binario guardado tiene que ser estado Yjs, no una foto JSON del tablero.

**Rotar invitación y morir antes de guardar.** Si la rotación solo viviera en memoria, el arranque devolvería el token viejo. La escritura de la identidad nueva es inmediata, independiente del debounce del documento.

**Almacén ilegible.** El host no llama a `generarIdentidadDeSala()` para «seguir». Registra la causa y no publica una sala nueva. Una sala nueva sería un dato perdido sin aviso.

## 9. Decisiones

E1 y E2 se cerraron el 2026-11-12 para poder hacer D1. El criterio fue el que ya está escrito en este motor y en IOKOIA Space, no una preferencia nueva.

### E1 — Almacén del host (cerrada)

**Documento Yjs.** Mismo patrón que la system DB de Space (`SPACE_SERVER_DB`, por defecto `./data/space-server.sqlite`, req 11.1): archivo del proceso, `better-sqlite3`, fuera de PowerSync.

| Qué | Valor |
|-----|--------|
| Variable | `SALA_SQLITE` |
| Si no está definida | `data/sala.sqlite` respecto al cwd del proceso. PM2 arranca el host con cwd `apps/host`, así que en desarrollo el archivo es `apps/host/data/sala.sqlite` |
| Si está definida y vacía | El host no arranca |
| `:memory:` o cadena vacía como ruta | Se rechaza. La extensión las aceptaría y no sobrevivirían al reinicio |
| Motor | `@hocuspocus/extension-sqlite` 4.7.0, el mismo corte que `@hocuspocus/server` de este host, con `better-sqlite3` 12.11.1 (la 13 no trae binario para este Node y en la máquina no hay `make`) |

El directorio padre se crea al arrancar. `data/` y `*.sqlite` ya están en `.gitignore`.

**Identidad (D2).** No va en ese SQLite ni en el `Y.Doc`. La referencia Space lo dice así: los tokens de host, de invitación y los JWT no viven en claro en un SQLite. El adaptador Node de `@iokoia/space-secrets` es solo memoria y se pierde al reiniciar.

Space persiste secretos en el escritorio con el crate Rust `keyring`, servicio `iokoia.space`. El host es un proceso Node, así que D2 usa el binding de ese mismo crate: `@napi-rs/keyring` 2.1.2. Servicio `iokoia.harukoia`, cuenta `identidad-de-sala` (o `SALA_IDENTIDAD` si está definida; vacía, el host no arranca). En Linux el almacén queda fijado a `secret-service`. El binding, si no se le pide un almacén, cae al keyring del kernel, y ese no sobrevive a un reinicio. Una entrada ausente es el primer arranque. Una entrada ilegible o un almacén cerrado no generan otra identidad.

### E2 — Ventana de guardado (cerrada)

Se dejan los valores de fábrica de Hocuspocus: `debounce` 2 s y `maxDebounce` 10 s. Su documentación pide no guardar cada update, porque `onStoreDocument` puede dispararse varias veces por segundo.

`cerrar()` ya espera a `directa.disconnect()`. Ese camino guarda el documento al momento (debounce 0) y es el vaciado del apagado limpio. Este host no usa `Server.listen()`, así que el vaciado no es `Server.destroy()`: es el disconnect de la conexión directa.

Un SIGKILL dentro de la ventana puede perder trazos. No hay forma de enumerarlos. El aviso en la interfaz no es D1: es D7, cuando el arranque distinga un cierre que no vació el guardado. Hasta entonces el límite queda escrito aquí.

### E4 — Espera al host (cerrada)

H3-T4 pide reconectar a quien se quedó en la página, sin recargar, cuando el host vuelve. Cerrar la laptop puede durar más de dos minutos. El tope de 120 s trataba esa ausencia como sala cerrada aunque la identidad siguiera viva, y obligaba a pulsar Reintentar.

Se quita el tope para un rechazo temporal después de haber entrado (`sala-no-encontrada`, `ticket-invalido`, `emparejamiento-expirado`). La página se queda en «Esperando al host…» y el proveedor sigue reintentando, con la misma espera creciente de antes. Cuando el host vuelve, entra sola. `host-cerro-la-sala` y el resto de rechazos definitivos siguen parando: no se convierten en un reintento infinito.

### E3 — Compactación (cerrada)

H3-T3 queda cubierto por lo que ya persiste D1: un estado codificado del `Y.Doc`, no una lista que crece con cada update. No hay otra operación ni otro disparador en H3.

La sección 10 del análisis v2 sigue vigente para el commit: «Se compacta al commitear y el commit guarda el estado, no todo el historial de deltas». Ese disparador es H4. D8 no agrega código.

### Las que siguen abiertas

Ninguna de esta épica.

## 10. Errores

| ID | Qué pasa | Qué tiene que observarse |
|----|----------|--------------------------|
| F1 | SIGKILL dentro de la ventana de E2 | En disco está el último guardado. El aviso es el que E2 haya fijado. No se fabrica una sala nueva |
| F2 | SIGTERM | Sale `host-cerro-la-sala`, el proceso termina, el pendiente quedó escrito. La prueba actual de resistencia sigue en verde. El siguiente arranque carga esa sala |
| F3 | La entrada del keyring no se lee o no es una identidad | El proceso no genera otra identidad. La causa queda en el log del host |
| F4 | Primer arranque, sin entrada | Una identidad, escrita en el keyring antes de `registrar` |
| F5 | Se rota la invitación y el proceso muere enseguida | El token vigente es el nuevo. El viejo sigue rechazado |
| F6 | Los tokens se cuelan en el `Y.Doc` | No puede ocurrir: el invitado sincroniza ese documento. Una prueba lee el estado codificado y no encuentra los tokens |
| F7 | El arranque genera otra identidad habiendo entrada | El link viejo moriría y el documento quedaría huérfano. Es un fallo del paso, no un modo de recuperación |
| F8 | La awareness restaurada muestra gente que ya no está | Tras cargar, la presencia está vacía hasta que las conexiones se anuncian |
| F9 | Muere el orquestador | El host conserva documento e identidad y se vuelve a registrar. Regresión de la prueba actual |
| F10 | Un segundo proceso host abre el mismo archivo | Falla al abrirlo: `database is locked`. No se registra. El proceso que ya lo tenía sigue. Quien solo lee el archivo no queda bloqueado |
| F11 | El invitado trae updates de mientras el host estaba muerto | Convergen los dos estados. No se duplican registros del mapa `tablero` por haber guardado JSON |
| F12 | `onStoreDocument` lanza (disco lleno, archivo bloqueado) | El documento sigue en memoria y Hocuspocus reintenta. El log del host dice la causa. Si el proceso muere antes de un reintento exitoso, es F1 |
| F13 | El host no está y el cierre no fue definitivo | La página sigue en «Esperando al host…» y entra sola cuando el host vuelve. El reloj no la pasa a sala cerrada |
| F14 | Cierre definitivo y, más tarde, el mismo host arranca | Quien recibió `host-cerro-la-sala` no entra solo. El mismo link, abierto de nuevo, ve el documento restaurado |
| F15 | Muere el relay con el host vivo | No se pierden trazos. Regresión de H1/H2 |
| F16 | Se quita la conexión directa | La sala se vacía al irse el último invitado, con el host vivo. No se quita |
| F17 | Este SQLite y el de PowerSync comparten archivo | Fuera de esta épica. Un review del paso lo rechaza |
| F18 | Un camino de lectura alternativo «por si el keyring no está» | Prohibido. Entrada ausente en el primer arranque es F4. Entrada presente e ilegible es F3 |

## 11. Pruebas que esta épica tiene que poder pasar

De la fase 1 y de la sección 11 del v2, acotadas a lo que H3 puede demostrar sin commits ni réplica:

- Reiniciar el proceso host devuelve el mismo identificador, el mismo token de invitación vigente y el documento en el último estado guardado.
- Matar el host con SIGKILL y volver a levantarlo no pierde lo ya guardado. Quien sigue con el mismo proveedor recibe ese estado sin recargar la página, con la política de E4.
- Matar el orquestador en medio de la sesión no pierde el documento. Al volver, la misma sala se registra.
- Partir la red y meter latencia sigue convergiendo (regresión del arnés de `resistencia`).
- Un invitado escribe sin red, el host reinicia, al reconectar los dos estados se fusionan.
- Recargar al invitado usa el log de IndexedDB de H2 contra la sala restaurada.
- SIGTERM sigue entregando `host-cerro-la-sala` y no convierte ese cierre en un reintento infinito.
- Almacén ilegible: el host no publica otra sala.
- Rotar la invitación sobrevive a un reinicio inmediato.
- El estado guardado no contiene los tokens.
- Tras restaurar, la awareness no conserva participantes fantasma.
- Typecheck y las pruebas de los paquetes tocados, en cada paso de código.

El caso «el host se cae y el último commit queda intacto» sigue fuera: no hay commits.

## 12. Definition of done

El de la fase 1, sección 6, más lo que el v2 pide para esta historia:

1. Reiniciar el contenedor host devuelve la sala en el último estado guardado del documento. No hay commit con el que comparar.
2. Matar el relay no pierde trazos: al reconectar, converge.
3. Si algo se perdió, se sabe. El caso de la ventana de debounce queda explícito en E2 antes de dar la épica por cerrada.
4. El mismo link vuelve a abrir esa sala en este host.
5. El orquestador sigue sin persistir y sin vocabulario de pizarra.
6. El disco de H3 no es PowerSync.

## 13. Referencias

- [fase 1, H3](../../../fijos/fases/fase-1-modulos-y-tareas.md) (sección 6, y M4–M6, M8, M18, M19, M20)
- [analisis-arquitectura-v2](../../../fijos/arquitectura/analisis-arquitectura-v2.md) secciones 5, 6, 8, 10, 11 y 14
- [análisis H0/H1](../motor/analisis-h0-h1-cimientos-y-sala.md) (D2, D4, D5, nota de SQLite para H3)
- [README de H0/H1](../motor/README.md) (sala en memoria, cierre 4410, resistencia)
- [análisis H2](../pizarra-colaborativa/analisis-h2-pizarra-colaborativa.md) (E5: IndexedDB no restaura el host)
- [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md) secciones 5 y 6
- Hocuspocus 4.7: [SQLite](https://tiptap.dev/docs/hocuspocus/server/extensions/sqlite), [persistencia](https://tiptap.dev/docs/hocuspocus/guides/persistence), [hooks y debounce](https://tiptap.dev/docs/hocuspocus/server/hooks), [configuración](https://tiptap.dev/docs/hocuspocus/server/configuration)
