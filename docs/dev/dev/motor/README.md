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
| B1 | Contrato del protocolo | Pendiente |
| B2 | Registro de salas | Pendiente |
| B3 | Túnel del orquestador | Pendiente |
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

## Formato de log

Fijado en el paso A6. Una línea por evento, igual en los tres procesos, en [`packages/registro`](../../../../packages/registro/README.md).

```text
2026-10-04T09:12:33.481Z info  orquestador sala=4k7m conexion=9b2 invitado entró
```

Texto con pares `clave=valor`, no JSON: se lee con `tail` y se filtra con `grep sala=<id>`. Un evento es **siempre** una sola línea; los saltos se escapan. Seguir una sala completa entre los tres procesos:

```bash
grep "sala=<id>" apps/*/logs/pm2/*.log | sort
```

**Pendiente que destapó este paso:** `registro` se consume desde su fuente (`exports` → `src/index.ts`), mientras que `domain` y `schema` publican `dist`. Dos formas de consumir un paquete interno. Hay que unificarlas en **B1**, que es cuando el protocolo entra en `domain` y los tres procesos lo importan de verdad.

## Dónde vive cada prueba

Decidido en el paso A4. El runner es **Vitest** en todo el monorepo.

| Tipo de prueba | Dónde | Ejemplo |
|----------------|-------|---------|
| Una función, un módulo, un proceso contra sí mismo | **Junto al código que prueba**, misma carpeta | `apps/orchestrator/src/diagnostico-de-eco/eco.test.ts` |
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
| D8 | Vitest como runner de todo el monorepo |

**Pendientes:** D4 y D5 antes del paso B2; D2 antes de B5; D6, D7 y D9 en el paso donde aparecen.

## Decisiones que podrían malinterpretarse

1. **H1 monta la sala real sin lienzo.** No es un adelanto de H2: la presencia se apoya en el mecanismo de la sala para no construir uno que se tire.
2. **La sala no persiste en esta rama.** Reiniciar el host la deja vacía, y está bien. La persistencia es H3.
3. **El orquestador no sabe qué transporta.** Si en su código aparece vocabulario de pizarra, está mal puesto.
4. **El contrato del protocolo vive en `packages/domain`**, no dentro del orquestador ni del host.
5. **Sin `enum`, `namespace`, propiedades declaradas en el constructor ni decoradores.** Node ejecuta TypeScript quitando los tipos, no transformándolos: esas construcciones compilan y fallan al correr.
6. **Los imports relativos llevan su extensión real** (`./eco.ts`, `./app.tsx`). Es consecuencia de lo anterior: Node no adivina la extensión. Los paquetes de servidor compilan con la reescritura de extensión activada, para que la salida siga apuntando a `.js`. Hallazgo del paso A3; se formaliza en A5.
7. **El orden de épicas de este plan sustituye** al orden de la sección 12 del análisis de arquitectura v2.
