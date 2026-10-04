# Checkpoints 3 y 4 — demostración entre dos redes y cierre de H1

El plan los coloca **después de B6** (checkpoint 3) y **después de B9** (checkpoint 4). Este documento es la lista para hacerlos **ahora**, con B7, B8 y B9 ya en el código.

> **Checkpoint 3.** Demostración entre las dos máquinas, en redes distintas. Es la primera vez que H1 se ve como funcionalidad.
>
> **Checkpoint 4.** H1 cerrada. Se revisa el bloque de mecanismo del análisis: si alguna palabra de pizarra se coló en el orquestador o en el contrato del relay, se corrige antes de cerrar la rama.

**Estado al escribir esto (2026-10-04).** El código de H1 está hecho. El typecheck pasa. Las 243 pruebas automatizadas pasan. El checkpoint 3 se marcó “pasado” en el README porque se vio entrar a alguien; **esta lista es la pasada completa**, la que no se hizo por ir rápido. El checkpoint 4 (vocabulario) ya se revisó en código: veredicto más abajo. Lo que falta es **recorrer esta lista a mano** y tachar.

---

## Antes de empezar

| Qué | Valor |
|---|---|
| Rama | `dev/motor` |
| Web de cada máquina | `https://web.harukoia.local.iokoia.dev/` |
| Host de cada máquina | `https://host.harukoia.local.iokoia.dev/` |
| Orquestador compartido | `wss://orquestador.harukoia.makinohara.sys.iokoia.com` |
| Guía de `.env` | [configuracion-del-entorno.md](../../../fijos/configuracion-del-entorno.md) |

**Las dos máquinas tienen que apuntar al mismo orquestador** (Makino Hara). Si una usa el local, la otra no la ve.

En cada máquina, en `apps/host/.env` y `apps/web/.env`:

```text
ORQUESTADOR_URL=wss://orquestador.harukoia.makinohara.sys.iokoia.com
VITE_ORQUESTADOR_URL=wss://orquestador.harukoia.makinohara.sys.iokoia.com
```

Si acabas de cambiar el `.env`, `dev:restart` **no lo relee**. Hay que borrar el proceso y arrancarlo:

```bash
# en apps/host
pnpm exec pm2 delete harukoia-host-dev && pnpm dev:start
# en apps/web
pnpm exec pm2 delete harukoia-web-dev && pnpm dev:start
```

Cada reinicio del host crea una **sala nueva**. Los links viejos dejan de servir.

**Máquina A** = quien abre la sala (host). **Máquina B** = quien entra por el link (espectador). Mejor en redes distintas (casa / oficina / datos del celular). Si B no puede, una ventana de incógnito en A sirve para **roles y cambiar link**, pero **no** cierra el checkpoint 3: ese exige otra red.

---

# Checkpoint 3 — dos máquinas, redes distintas

## 0. Humo automático (en la laptop de A, antes de invitar)

```bash
pnpm typecheck
pnpm test
```

Esperado: typecheck sin errores; las pruebas del monorepo en verde (hoy: 243).

Comprueba también que el orquestador de Makino Hara responde:

```bash
curl https://orquestador.harukoia.makinohara.sys.iokoia.com/health
# {"service":"orchestrator","status":"ok"}
```

Si eso falla, **no sigas**. El túnel no tiene a quién hablarle.

## 1. Arranque en las dos máquinas

En **A** y en **B**:

1. `git checkout dev/motor` y `git pull` (mismo commit).
2. `pnpm install` si hace falta.
3. En la raíz: `pnpm dev:start` (o `dev:start` en host y web).
4. Abrir `https://web.harukoia.local.iokoia.dev/`.

Esperado: la web carga. En A, el host está arriba (`pnpm --filter @harukoia/host dev:status`).

## 2. Nombre

1. Si es la primera vez, la web pide el nombre. Pon uno (por ejemplo `hector`).
2. Recarga la página.

Esperado: **no** vuelve a pedirlo. El nombre quedó.

3. Pulsa “Cambiar nombre”, pon otro, recarga.

Esperado: se acuerda del nuevo.

## 3. Volverme host (solo A)

1. En A, pulsa **Volverme host**.
2. Entra a la sala.

Esperado:

- Estado: **Conectado**.
- Abajo: `Orquestador: orquestador.harukoia.makinohara.sys.iokoia.com`.
- En la lista: tu nombre con rol **host**, y “(tú)”.
- Se ven **Copiar link** y **Cambiar link**.

Si dice “No hay un host corriendo…”, arranca el host. Si dice que el host no le dio la invitación, revisa `WEB_ORIGEN` en `apps/host/.env`.

## 4. El link no manda el token al servidor

1. Mira la barra: `https://web…/s/<sala>#<token>`. El token va **después del `#`**.
2. Copia el link y pégaselo a B por chat / correo.

Esperado: en el historial del proxy o en los logs del orquestador **no** aparece el token del `#`. (El identificador de sala sí puede aparecer: no es el secreto.)

## 5. B entra por el link (esto cierra o tumba el checkpoint)

En **B**, otra red:

1. Abre el link (o pégalo en “Unirme”).
2. Elige un nombre distinto (ventana de incógnito si es la misma máquina).

Esperado:

- Estado: **Conectado**.
- El mismo orquestador que A.
- En la lista de **las dos** máquinas: los dos nombres.
- B se ve como **espectador**.
- B **no** ve Copiar link ni Cambiar link.

Si B ve “La sala no está abierta en este orquestador…”, A y B no apuntan al mismo orquestador. Mira la línea “Orquestador:” en las dos pantallas.

## 6. Se ven y se van

1. B pulsa **Salir de la sala**.

Esperado en A: B desaparece de la lista **enseguida**, no a los 30 s.

2. B vuelve a entrar con el **mismo** link.

Esperado: entra otra vez. A lo vuelve a ver.

## 7. Roles (B8) — no se puede mentir

1. En A: tú = host. En B: tú = espectador.
2. (Opcional, para quien sepa abrir herramientas de desarrollo.) En B, en la consola, intenta ponerse rol de host. A tiene que seguir viendo a B como espectador.

Esperado: el rol lo decide el host, no la pestaña.

## 8. Cambiar el link (B8)

1. En A, pulsa **Cambiar link**.
2. Espera el aviso: “Link nuevo. El anterior ya no deja entrar…”.
3. La barra de A cambia sola (el `#` es otro). **No** recargues.
4. Copia el link **nuevo**.
5. En B (quien **ya estaba** dentro): sigue conectado, misma lista.
6. En una pestaña o máquina **nueva**, abre el link **viejo**.

Esperado: el viejo dice que el link no es válido o el host ya lo cambió. El nuevo sí deja entrar.

Si A dice “El orquestador no respondió y el link no cambió”, el de Makino Hara no tiene B8. Redespliégalo en Coolify y vuelve a este paso.

## 9. Link roto (sin tocar el host)

1. Abre `https://web.harukoia.local.iokoia.dev/s/sala-inventada`.
2. Abre un link con `#` corto o vacío.

Esperado: mensaje de link incompleto o roto, con botón **Ir al inicio**. No una página en blanco.

## 10. Apagar el host (B7)

1. A y B están dentro.
2. En A: `pnpm --filter @harukoia/host dev:stop` (o `dev:stop` dentro de `apps/host`).

Esperado en B: **“El host cerró la sala.”** Se detiene. **No** hay Reintentar. **No** se queda en “Reconectando…”.

3. Arranca el host otra vez. **No** uses el link viejo: esa sala ya no existe.
4. En A, **Volverme host** de nuevo. Manda el link **nuevo** a B.

## 11. Caída del orquestador (B7) — si puedes

Solo si puedes **reiniciar** el contenedor en Coolify un momento, no apagarlo para siempre.

1. A y B están dentro.
2. Reinicia el orquestador en Coolify.
3. Mira las dos webs **sin recargar**.

Esperado: pasan por **Reconectando…** (o **Esperando al host…**) y vuelven a **Conectado** solas, con la misma lista. Si a los 2 minutos dice “La sala se cerró” y Reintentar, el host no alcanzó a registrarse otra vez: espera a que el host esté arriba y pulsa Reintentar.

## 12. Recarga de la pestaña del host

1. A es host y está en la sala.
2. Recarga la pestaña (F5).

Esperado: sigue siendo **host** (la credencial está en la pestaña). El botón Cambiar link sigue ahí.

---

## Lista de verificación del checkpoint 3

Tacha cuando lo hayas visto **tú**, no cuando el código compile.

| # | Prueba | Resultado esperado | ¿Pasó? |
|---|---|---|---|
| 0 | `pnpm typecheck` y `pnpm test` | Verde | ☐ |
| 0b | `/health` de Makino Hara | `{"service":"orchestrator","status":"ok"}` | ☐ |
| 1 | Las dos máquinas levantan la web | Carga | ☐ |
| 2 | El nombre se recuerda | No lo pide otra vez | ☐ |
| 3 | Volverme host | Conectado, rol host, Copiar y Cambiar link | ☐ |
| 4 | El token va en el `#` | No en la ruta ni en logs del proxy | ☐ |
| 5 | B entra desde **otra red** | Las dos listas muestran a los dos; B es espectador | ☐ |
| 6 | B sale y vuelve | Desaparece al salir; entra otra vez | ☐ |
| 7 | Los roles no se mienten | A = host, B = espectador | ☐ |
| 8 | Cambiar link | Viejo no deja entrar; B que ya estaba sigue | ☐ |
| 9 | Link roto | Mensaje claro, no pantalla vacía | ☐ |
| 10 | Apagar el host | “El host cerró la sala.”, sin reintentar | ☐ |
| 11 | Reiniciar el orquestador | Vuelven solos, sin recargar (si lo pudiste hacer) | ☐ |
| 12 | Recargar la pestaña del host | Sigue siendo host | ☐ |

**El checkpoint 3 cierra cuando 1–10 están tachados.** El 5 es el que no se puede sustituir por incógnito. El 11 es deseable; si Coolify no se puede tocar ahora, anótalo y sigue.

Cuando termines, pon aquí la evidencia:

```
Estado: pendiente.

Fecha:
Máquina A (host):
Máquina B (invitado, red):
Orquestador:
Commit:
```

---

# Checkpoint 4 — el orquestador no sabe qué transporta

No se prueba en el navegador. Se revisa el código y se confirma que las pruebas automatizadas de H1 siguen verdes.

## Qué se revisa

Del [análisis](./analisis-h0-h1-cimientos-y-sala.md), bloque de mecanismo:

> Nada en el orquestador se llama "pizarra" ni "sesión de dibujo". El orquestador no sabe qué transporta. Si en el código del relay aparece una palabra de la pizarra, está mal puesta.

Palabras que **no** pueden aparecer en el **contrato** ni en la **lógica** del orquestador: `pizarra`, `lienzo`, `dibujo`, `trazo`, `figura`, `excalidraw`, `whiteboard`, `Hocuspocus`, `Yjs` / `yjs`.

`tablero` en un comentario que dice “el orquestador **no** guarda el tablero” es prosa de arquitectura, no un tipo del protocolo. Igual: un comentario que **prohíbe** la palabra `pizarra`.

## Cómo comprobarlo tú

Desde la raíz:

```bash
# Contrato del relay: ningún tipo ni mensaje con esas palabras
rg -n -i 'pizarra|lienzo|dibujo|trazo|figura|excalidraw|whiteboard|hocuspocus|\byjs\b' \
  packages/domain/src/relay --glob '!*.test.ts'

# Lógica del orquestador
rg -n -i 'pizarra|lienzo|dibujo|trazo|figura|excalidraw|whiteboard|hocuspocus|\byjs\b' \
  apps/orchestrator/src
```

Esperado: **cero** coincidencias en tipos, campos y `tipo:` de mensajes. Si sale algo, es un fallo del checkpoint 4.

La prueba que ya existe y hay que seguir viendo verde:

```bash
pnpm --filter @harukoia/domain exec vitest run src/relay/codec-de-control
# incluye: "ningún mensaje de control lleva vocabulario de pizarra"
```

Criterios 7, 8 y 9 del *definition of done* (ya automatizados; no hace falta repetirlos a mano si `pnpm test` pasó):

| Criterio | Dónde |
|---|---|
| Un espectador no puede ejecutar acciones de host ni a mano | `packages/pruebas-entre-procesos/src/roles/` |
| Diez participantes convergen | `packages/pruebas-entre-procesos/src/muchos-participantes/` |
| Sin fugas tras cien ciclos | `apps/orchestrator/src/tunel/tunel.test.ts` y `apps/host/src/sala/sala.test.ts` |

## Veredicto del checkpoint 4 (revisión del 2026-10-04)

**El protocolo y el orquestador no conocen la pizarra.** No hay `Hocuspocus` ni `Yjs` en el orquestador. El relay copia bytes después de emparejar, sin mirarlos.

Lo que sí aparece, y **no** rompe el checkpoint:

| Dónde | Qué | Por qué no cuenta |
|---|---|---|
| `apps/orchestrator/src/registro-de-salas/registro-de-salas.ts` (comentario) | “El tablero vive en el host.” | Dice lo que **no** sabe |
| `apps/orchestrator/README.md` y `package.json` | “No guarda el tablero.” / `relay por roomId` | Documentación. `roomId` es un descuido de nombre frente a `sala` |
| `packages/domain/src/relay/mensaje-de-control/mensaje-de-control.ts` | “Nada de vocabulario de pizarra…” | Guardrail |
| `packages/domain/src/relay/codec-de-control/codec-de-control.test.ts` | Lista de palabras prohibidas | La prueba del checkpoint |

Cuando hayas corrido los `rg` y `pnpm test`:

```
Estado: revisión de código hecha el 2026-10-04; falta tu visto bueno.

Fecha en que lo confirmaste:
```

---

# Chequeo de calidad del código de H1 (2026-10-04)

Revisión de las líneas de esta rama: contrato, orquestador, host, web y pruebas entre procesos. No se cambió código en este paso: lo que hay que arreglar queda listado para que decidas.

## Lo que está bien

- Typecheck del monorepo: limpio. Pruebas: **243** verdes.
- Sin `enum`, `namespace`, propiedades de constructor ni decoradores en el código de producto. Node les quitaría los tipos y fallarían al correr.
- Layout por dueño: una carpeta por mecanismo (`rol/`, `accion-de-sala/`, `rol-de-la-conexion/`, `credencial-de-host/`). No hay `utils/` ni `types/` sueltos.
- El rol lo decide el host (`onAuthenticate` + sello en la presencia). La web **no** anuncia `rol`. El módulo viejo `rol-en-la-pestana` ya no existe.
- `tokenDeHost` no sale por `GET /invitacion` ni por el link. `tokenDeWebDelHost` no va en el link: solo por `/invitacion` y en el `sessionStorage` de esa pestaña.
- Comparación de tokens en tiempo constante. Tickets de un solo uso. El token de invitación viaja en el primer mensaje, no en la URL.
- Una acción nueva no compila sin decidir el rol que exige (`Record`). Una causa de rechazo nueva no compila sin decidir si es temporal o definitiva.
- Las pruebas de roles y de diez participantes **sí detectan fallas**: se rompió a propósito el sello del rol, el amarre de presencia y el reenvío del relay, y fallaron.

## Hallazgos — arreglados el 2026-10-04

| # | Qué se hizo |
|---|---|
| 1 | El proceso llama a `tunel.barrer()` cada 10 s. El barrido avisa al host (`host-sin-latido`) y echa a los invitados, unidos o todavía emparejando, con el código `4410` |
| 2 | Un `latido` rechazado se contesta con `registro-rechazado` y la causa |
| 3 | Al `cerrar-sala`, quien todavía emparejaba recibe `4410` / `host-cerro-la-sala`, no `sala-no-encontrada` |
| 4 | `humo.mjs` registra solo sala, token de host y token de invitación. El token de la web del host no viaja |
| 5 | `engines.node` de la raíz es `>=23.6` |
| 6 | `start` del orquestador y del host ejecuta `src/main.ts` |
| 7 | El host ya no imprime el token de invitación al arrancar. Se pide con “Volverme host” |
| 8 | Sin segundo arnés de Hocuspocus en las pruebas de la web. Los roles los cubren `packages/pruebas-entre-procesos/src/roles/` |

## Fuera de alcance (no son fallos de H1)

- La sala no persiste: reiniciar el host la vacía (H3).
- No hay lienzo (H2).
- No hay commits (H4).
- D6 (una sala por host) sigue sin confirmar.
- El protocolo no lleva número de versión (pendiente desde B1).
- Falta probar a mano **suspender y despertar** la laptop (B4).
- Falta A2 en la máquina de Kua.

## Definition of done de la rama — cómo va

| # | Criterio | Estado |
|---|---|---|
| 1 | Las dos personas levantan y apagan el motor | Parcial — falta la máquina de Kua |
| 2 | `pnpm typecheck` y `pnpm test` | **Hecho** (2026-10-04, 243 pruebas) |
| 3 | Alguien en otra red entra por el link | **Tú lo tachas** en la tabla del checkpoint 3, fila 5 |
| 4 | Se ven con nombre y desaparecen al salir | Automatizado + **tú** en la fila 6 |
| 5 | Matar el orquestador no obliga a recargar | Automatizado; **tú** en la fila 11 si puedes |
| 6 | Apagar el host muestra “sala cerrada” | Automatizado; **tú** en la fila 10 |
| 7 | Un espectador no puede acciones de host ni a mano | **Hecho** (pruebas de B8) |
| 8 | Diez participantes convergen | **Hecho** (B9) |
| 9 | Sin fugas tras cien ciclos | **Hecho** (B7) |
| 10 | El orquestador no conoce el contenido | **Hecho** en revisión de código; **tú** confirmas el checkpoint 4 |

---

## Si falla (checkpoint 3)

| Ves | Qué significa |
|---|---|
| “La sala no está abierta en este orquestador…” | Host e invitado en orquestadores distintos, o el host no está registrado |
| “No hay un host corriendo en esta máquina” | El host de A no está arriba |
| “El host de esta máquina no le dio la invitación…” | `WEB_ORIGEN` no coincide con la URL de la web |
| B entra pero no ve a A, o al revés | Espera unos segundos; si no, las dos webs no están en el mismo orquestador (mira la línea “Orquestador:”) |
| “Cambiar link” no cambia nada | Orquestador de Makino Hara sin B8 → redesplegar |
| B se queda en “Reconectando…” al apagar el host | El orquestador no mandó el cierre `4410` → redesplegar |
| El link de ayer no sirve | Normal: el host se reinició y la sala es otra |

Cuando 1–10 del checkpoint 3 y el visto bueno del 4 estén tachados → **H1 se puede cerrar**.
