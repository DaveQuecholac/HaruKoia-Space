# Rama `dev/motor`

Primeras dos épicas del motor colaborativo: **H0 Cimientos** y **H1 Sala por link**.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h0-h1-cimientos-y-sala.md](./analisis-h0-h1-cimientos-y-sala.md) | Por qué esta rebanada primero, qué fija el diseño, decisiones abiertas, riesgos |
| [plan-h0-h1-cimientos-y-sala.md](./plan-h0-h1-cimientos-y-sala.md) | Quince pasos con verificación, criterios y errores previstos |

Épicas y módulos de toda la fase: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).
Arquitectura vigente: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

## Alcance

**Entra.** Arranque verificado en las dos máquinas, andamio de pruebas, reglas del contrato de datos, registro de salas, relay, sala en vivo mínima, presencia, roles mínimos y las pantallas de entrada.

**No entra.** Lienzo (H2), persistencia de la sala (H3), commits (H4), publicación y CLI (H5), autenticación, sala global (H7).

Si algo de la segunda lista aparece en un diff de esta rama, está fuera de alcance.

## Estado

| Paso | Qué | Estado |
|------|-----|--------|
| A1 | Rama y documentación | Hecho |
| A2 | Arranque en las dos máquinas | Parcial — verificado aquí; falta la máquina de Kua |
| A3 | Humo de WebSocket por el proxy | Hecho — 6 de 6 comprobaciones |
| A4 | Andamio de pruebas | Hecho — Vitest, 5 pruebas |
| A5 | Reglas del contrato | Hecho — falta que Kua las revise |
| A6 | Formato de log | Hecho |
| B1 | Contrato del protocolo | Hecho |
| B2 | Registro de salas | Hecho |
| B3 | Túnel del orquestador | Hecho — falta el checkpoint 2 entre dos redes |
| B4 | Conexión del host | Pendiente |
| B5 | Sala en vivo y presencia | Pendiente |
| B6 | Web: nombre, volverme host, unirme | Pendiente |
| B7 | Resistencia y reconexión | Pendiente |
| B8 | Roles mínimos | Pendiente |
| B9 | Varios participantes y cierre | Pendiente |

El esqueleto del monorepo y el arranque con PM2 y portless ya existen del trabajo previo a esta rama; A2 es verificarlo en las dos máquinas, no construirlo.

## Reglas del contrato

Fijadas en el paso A5. Son lo más caro de cambiar después, así que **las dos personas tienen que estar de acuerdo** antes de seguir.

| Regla | Decisión | Dónde |
|-------|----------|-------|
| Identificadores | 32 símbolos sin `i`, `l`, `o`, `u`; mínimo 16 caracteres (80 bits); Web Crypto | [`packages/domain`](../../../../packages/domain/README.md) |
| Tipado de identificadores | `Identificador<'sala'>` no es asignable a `Identificador<'commit'>` | `packages/domain/src/identificador/` |
| Orden de réplica | Por `actualizadoEn` y, a marca igual, por `id`. La marca **la pone el host**, nunca el cliente | [`packages/schema`](../../../../packages/schema/README.md) |
| Borrado | Lógico con `borrado: true`. Lo replicado nunca se borra físicamente | `packages/schema/src/documento-replicado/` |
| Versión de esquema | Por colección, con cadena de migraciones sin huecos. Se migra al leer, nunca hacia atrás | `packages/schema/src/version-de-esquema/` |
| Estilo | Uniones de literales y tipos planos; sin `enum`, `namespace`, propiedades de constructor ni decoradores | Las dos |

Lo que **no** se fijó aquí, a propósito: los campos de cada colección. Esos se cierran en la épica que los usa.

## Contrato del protocolo

Fijado en B1, en [`packages/domain`](../../../../packages/domain/README.md). Es el único lugar donde vive el protocolo.

| Decisión aterrizada | Cómo quedó |
|---|---|
| **D4** | Tres valores por sala: identificador de 16 caracteres para enrutar, token de host y token de invitación de 26 caracteres |
| **D5** | `host-reemplazado` es una de las causas de cierre del protocolo |
| Planos | **Control** en texto JSON; **datos** en binario opaco que el relay no mira |
| Canales | `relay/canal/canal.ts` es el único archivo que los enumera. Hoy: `sesion` |

**Pendiente de decidir, descubierto en este paso:** el protocolo **no lleva número de versión**. Orquestador y host se despliegan por separado, así que un día podrán tener versiones distintas del contrato. No lo agregué porque no estaba en el alcance de B1; hay que decidir si entra antes de B7.

## El túnel

Fijado en B3, en `apps/orchestrator/src/tunel/`. Tres rutas, declaradas en el contrato para que los tres procesos usen las mismas:

| Ruta | Quién la abre | Para qué |
|------|---------------|----------|
| `/relay/control` | Host | Permanente, una por sala. Registro, latido, avisos |
| `/relay/sala` | Invitado | Se vuelve conexión de datos al emparejarse |
| `/relay/datos` | Host | Una por invitado, **saliente**. Es el túnel inverso de D3 |

Las tres empiezan hablando control: su **primer mensaje** decide qué son. Después del emparejamiento, las de datos solo transportan bytes.

### Las cuatro decisiones de B3

| # | Decisión | Por qué |
|---|----------|---------|
| 1 | **El orquestador valida la invitación**; el registro lleva ese token | El relay ya transporta todos los bytes de la sesión en claro: esconderle este token no protegería nada y costaría una ida y vuelta |
| 2 | **Ticket de un solo uso** por invitado para la conexión de datos | El token de host recupera la sala y luego autoriza commits; que no viaje en cada entrada |
| 3 | El invitado manda su token en el **primer mensaje**, no en la URL | Un secreto en la URL acaba escrito en los logs de acceso del proxy |
| 4 | Topes: **10 s** de emparejamiento, **1 MB** por mensaje, **4 MB** de cola | Sin topes, un invitado que no drena convierte la memoria del orquestador en el límite del sistema, y eso tira todas las salas |

Un ticket equivocado y una conexión inexistente dan **el mismo** rechazo, a propósito: así no se puede sondear qué identificadores están vivos.

### Lo que el orquestador no hace

No interpreta lo que transporta. Hay una prueba que le manda bytes con la forma de un mensaje de control y verifica que pasan tal cual, sin que la sala se cierre.

### Rutas desconocidas

Se rechazan con un `404` HTTP inmediato. No hay handshake todavía, así que no se puede enviar un cierre de WebSocket. Dejarlas sin respuesta —como estaban al principio de B3— cuelga el socket y el cliente acaba viendo un cierre anormal con código 1006, sin causa.

### El eco de A3 se retiró

El túnel es el único dueño de la ruta de actualización de protocolo, así que el eco no podía seguir montado. Se borraron sus tres piezas: el módulo y las pruebas del orquestador, el script de humo, y el componente de la web con su variable de entorno. La web vuelve a ser el esqueleto que era, hasta que B6 le dé pantallas reales.

Mientras existió el huérfano, la web mostraba «conexión cerrada con código 1006». Era correcto —la ruta ya no existía— pero ilegible: **el navegador reporta 1006 ante cualquier handshake fallido y no expone el código HTTP a JavaScript**, así que el `404` del servidor nunca llegaba a verse en pantalla.

### Checkpoint 2 — pendiente

El plan exige probar el túnel **entre dos redes distintas**, y lo coloca **antes de B4**: se prueba con scripts en los dos extremos, no con el host real. Lo verificado hasta ahora es local, incluido el paso por el proxy de desarrollo.

El arnés está listo en `apps/orchestrator/src/tunel/humo.mjs`, con modo host y modo invitado. Importa el contrato de `@harukoia/domain` en vez de copiarlo, así que si el protocolo cambia el arnés se rompe en vez de mentir.

Lo único que falta es un orquestador con dirección alcanzable desde fuera. Decidido el 2026-10-04: **servidor con nombre público y TLS**, que además es el destino final según la arquitectura. Pasos exactos en [checkpoint-2-dos-redes.md](checkpoint-2-dos-redes.md).

## Registro de salas

Fijado en B2, en `apps/orchestrator/src/registro-de-salas/`. **En memoria, sin base de datos:** si el orquestador reinicia, los hosts se vuelven a registrar. No es una fuente de verdad que haya que conservar, es un directorio de lo que está vivo ahora.

| Regla | Cómo quedó |
|---|---|
| Tolerancia sin latido | **30 segundos** = tres latidos perdidos a uno cada 10. Es un parámetro inyectable, **falta confirmarlo** |
| Mismo host que vuelve | Reemplaza su registro y la conexión anterior se cierra con `host-reemplazado` (**D5**) |
| Otro host | Rechazo con `sala-ocupada-por-otro-host`; el host legítimo no se entera |
| Comparación de tokens | En tiempo constante: el tiempo de respuesta no revela cuántos caracteres acertó quien lo intenta |
| Expiración | Se **calcula** con un reloj inyectado, no se agenda con temporizadores. Las pruebas no esperan en tiempo real |
| `resolver` | Devuelve la sala **sin** su token de host: el secreto no sale del registro |

Quién llama a `barrer` periódicamente es asunto del proceso, en **B3**.

## Formato de log

Fijado en el paso A6. Una línea por evento, igual en los tres procesos, en [`packages/registro`](../../../../packages/registro/README.md).

```text
2026-10-04T09:12:33.481Z info  orquestador sala=4k7m conexion=9b2 invitado entró
```

Texto con pares `clave=valor`, no JSON: se lee con `tail` y se filtra con `grep sala=<id>`. Un evento es **siempre** una sola línea; los saltos se escapan. Seguir una sala completa entre los tres procesos:

```bash
grep "sala=<id>" apps/*/logs/pm2/*.log | sort
```

**Resuelto en B1:** los tres paquetes internos se consumen igual, desde su fuente (`exports` → `src/index.ts`). Node les quita los tipos al vuelo y Vite los transforma, así que no hay `dist` que pueda quedar viejo ni paso de construcción que recordar.

## Dónde vive cada prueba

Decidido en el paso A4. El runner es **Vitest** en todo el monorepo.

| Tipo de prueba | Dónde | Ejemplo |
|----------------|-------|---------|
| Una función, un módulo, un proceso contra sí mismo | **Junto al código que prueba**, misma carpeta | `apps/orchestrator/src/tunel/tunel.test.ts` |
| Dos o más procesos vivos a la vez | `packages/pruebas-entre-procesos/` | `src/arranque-de-los-procesos/arranque.test.ts` |
| Navegador real contra el motor | `packages/pruebas-entre-procesos/`, cuando exista | — |

Reglas, iguales para las dos: cada prueba levanta y tumba lo suyo, **puerto cero** leído de la salida del proceso en vez de puertos fijos, y tiempo máximo explícito en todo lo que abra un socket o lance un proceso. Detalle en el [README del paquete de pruebas](../../../../packages/pruebas-entre-procesos/README.md).

```bash
pnpm test                                        # todo el monorepo
pnpm --filter @harukoia/orchestrator test        # un paquete
```

## Decisiones

Ninguna la toma quien implementa. Están en la sección 3 del análisis con sus opciones y consecuencias.

**Confirmadas:**

| # | Decisión |
|---|----------|
| D1 | Servidor con `node:http` y `ws`, sin framework |
| D3 | **Relay por túnel inverso**: conexión de control permanente y una conexión de datos saliente por invitado |
| D4 | **Token de invitación aparte** del identificador de sala: el identificador enruta, el token da acceso y se puede revocar |
| D5 | El host que presenta el **token de host** correcto **reemplaza** el registro anterior; la conexión vieja se cierra |
| D8 | Vitest como runner de todo el monorepo |

**Pendientes:** D2 antes de B5; D6, D7 y D9 en el paso donde aparecen.

Con D4 y D5 confirmadas, el **checkpoint 1 está cerrado** y la fase B puede empezar por B1.

## Decisiones que podrían malinterpretarse

1. **H1 monta la sala real sin lienzo.** No es un adelanto de H2: la presencia se apoya en el mecanismo de la sala para no construir uno que se tire.
2. **La sala no persiste en esta rama.** Reiniciar el host la deja vacía, y está bien. La persistencia es H3.
3. **El orquestador no sabe qué transporta.** Si en su código aparece vocabulario de pizarra, está mal puesto.
4. **El contrato del protocolo vive en `packages/domain`**, no dentro del orquestador ni del host.
5. **Sin `enum`, `namespace`, propiedades declaradas en el constructor ni decoradores.** Node ejecuta TypeScript quitando los tipos, no transformándolos: esas construcciones compilan y fallan al correr.
6. **Los imports relativos llevan su extensión real** (`./eco.ts`, `./app.tsx`). Es consecuencia de lo anterior: Node no adivina la extensión. Los paquetes de servidor compilan con la reescritura de extensión activada, para que la salida siga apuntando a `.js`. Hallazgo del paso A3; se formaliza en A5.
7. **El orden de épicas de este plan sustituye** al orden de la sección 12 del análisis de arquitectura v2.
