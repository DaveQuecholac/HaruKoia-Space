# Análisis — H2 Pizarra colaborativa

Rama: `dev/pizarra-colaborativa`.  
Plan: [plan-h2-pizarra-colaborativa.md](./plan-h2-pizarra-colaborativa.md).

## 1. Por qué esta rebanada ahora

H0 y H1 ya resolvieron el riesgo duro: un invitado en otra red alcanza al host y ve presencia. La decisión D2 de `dev/motor` montó la **sala Yjs real** desde H1, a propósito, para que H2 sea “conectar el lienzo”, no “inventar de nuevo la sala y la presencia”.

Historia de producto (fase 1):

> Dibujo y mi trazo aparece en la pantalla de la otra persona, con su cursor moviéndose en el mío.

## 2. Qué ya existe (no se reconstruye)

| Pieza | Dónde | Rol en H2 |
|-------|-------|-----------|
| Orquestador + túnel inverso | `apps/orchestrator` | Transporta bytes de la sala; no sabe de pizarra |
| Contenedor host + Hocuspocus | `apps/host` (`sala/`) | Documento Yjs vivo; `handleConnection` ya enchufa invitados |
| Presencia (nombre) | Host + Yjs awareness | Se reutiliza; H2 añade cursor/selección de lienzo encima |
| Roles host / espectador | Host + web | Ambos dibujan; el rol no cambia en H2 |
| Pantallas de entrada | `apps/web` (Vite) | Siguen; el lienzo se monta **en la sala** |
| Cliente del relay | `packages/cliente-del-relay` | La web ya llega al host; el lienzo usa el mismo documento |

## 3. Qué entra y qué no

**Entra (H2-T1…T6):**

1. Lienzo tldraw montado en la web (sala).
2. Lienzo conectado al documento Yjs de la sala (mismo que H1).
3. Dos (o más) personas dibujando sin candados ni pisadas (CRDT).
4. Cursores y selección de los demás.
5. Sin red: se sigue dibujando; al volver, se fusiona (log Yjs en el cliente).
6. Latencia de un trazo medida contra el objetivo (< 150 ms por el relay, misma región).

**No entra:**

| Tema | Épica / motivo |
|------|----------------|
| Persistir el documento en disco del host / restaurar sala | H3 |
| Staging, commit, historial, checkout, traductor JSON | H4 |
| Push, CLI, réplica central de historial | H5 |
| IA, PDF, Word | H6 |
| Sala global | H7 |
| Autenticación | Después |
| Construir la app Expo como producto | Solo se **diseña** en esta rama (puerta C0); construirla exige autorización aparte |
| Teléfono como host local | Fuera de v1 |

## 4. Puerta obligatoria antes de código de lienzo — diseño Expo

La arquitectura v2 y el registro de stack lo fijan:

> Antes de H2 se escribe el **diseño de la app Expo** (pantallas, lienzo, arranque con PM2 y portless). Las pantallas de H1 siguen en Vite hasta que ese diseño exista y se autorice construir la app.

Ese diseño es el paso **C0** del plan. **No** es implementar Expo en H2. Es el documento que responde:

| Pregunta | Por qué importa |
|----------|-----------------|
| Pantallas y flujo (entrada, sala, lienzo) | Misma gramática web/móvil; sin pantallas distintas por rol |
| Dónde vive tldraw (componente DOM en Expo) | Decisión cerrada: Expo + DOM para el lienzo |
| Cómo arranca con PM2 y portless | Convención del monorepo; `PORTLESS_NAME`, `APP_NAME` |
| Qué se queda en `apps/web` (Vite) en H2 | H2 cablea el lienzo en Vite; Expo se construye cuando se autorice |
| SQLite RN / secrets | Partir de [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md); abrir `/home/davesq/Documents/IoKoia/space/` |
| Móvil = solo espectador o sala global | Un teléfono no es host local |

El borrador está en [diseno-app-expo.md](./diseno-app-expo.md). C0 quedó confirmado al seguir el plan. El layout de la sala (E1b) quedó visto: barra arriba y lienzo en el resto.

## 5. Mecanismo (capacidad extensible)

```text
Mecanismo de la capacidad: sincronizar el estado de trabajo del lienzo entre participantes de una sala
Variantes de hoy: pizarra tldraw sobre documento Yjs de la sala
Variantes probables siguientes: otros tipos de superficie colaborativa (mapa, diagrama de tipologías Space) sobre el mismo documento/sala
Módulo dueño: M8 Pizarra (lienzo) + M6 Sala en vivo (documento) + M7 Presencia
Plugins: binding tldraw ↔ Yjs; capa de cursores del lienzo
Prueba de extensión: otra superficie = otro binding al mismo documento de sala, sin segundo relay ni segunda presencia
Patrón existente a extender: sala Yjs + awareness de H1; cliente-del-relay
```

**Prohibido en H2:** meter lógica de formas/tldraw en orquestador o en el contrato del relay; bautizar el transporte como “pizarra”.

## 6. Modelo de datos en vivo (solo sesión)

| Dato | Dónde | Notas |
|------|-------|-------|
| Estado del tablero | Documento Yjs en el host (Hocuspocus) | Ya existe la sala; H2 escribe formas vía binding |
| Awareness (nombre, cursor, selección) | Awareness Yjs | Nombre ya va; H2 amplía campos de lienzo |
| Log local del invitado sin red | IndexedDB (cliente) | Arquitectura v2; permite fusionar al volver |
| Persistencia durable del host | Fuera | H3 |

No se tocan tablas de réplica ni esquema de commits.

## 7. Flujo esperado

1. Host y espectador ya están en la sala (H1).
2. La pantalla de sala monta tldraw.
3. El editor se enlaza al `Y.Doc` (o fragmento acordado) de la conexión existente.
4. Un trazo en A aparece en B por el mismo relay/túnel.
5. Cursores ajenos se ven con nombre.
6. Si B pierde red, sigue dibujando en local; al reconectar, Yjs fusiona.
7. Se mide latencia trazo A→B.

## 8. Decisiones a confirmar (bloquean pasos del plan)

| ID | Tema | Opciones / nota | Bloquea |
|----|------|-----------------|---------|
| E1 | Contenido del diseño Expo (C0) | Escrito en `diseno-app-expo.md`. El chat pidió seguir | Todo código de lienzo |
| E1b | Layout de la sala al montar el lienzo (C1) | Visto en el chat: barra arriba y lienzo en el resto | Código de C1 |
| E2 | Binding tldraw ↔ Yjs | Cerrado en el chat. El store de tldraw (`createTLStore`, `store.listen` con `source: 'user'` y `scope: 'document'`, cambios ajenos con `mergeRemoteChanges`) escribe en el `Y.Doc` de la conexión. No se usa `@tldraw/sync` | C2 |
| E3 | Fragmento Yjs del tablero | Cerrado en el chat. Un `Y.Map` `tablero` en ese documento. Cada valor es el registro en JSON (texto), para que Yjs no lo convierta en otro mapa. La presencia sigue en awareness | C2 |
| E4 | Dónde medir latencia | Cerrado al medir. Prueba automatizada con dos clientes Yjs sin UI, por el relay local, escribiendo un registro en el mapa `tablero`. El número va en el README de la rama. El humo manual sigue siendo dos navegadores | C6 |
| E5 | Alcance offline en H2 | Cerrado al seguir el plan. Solo el cliente: el log Yjs del documento de la sala en IndexedDB (`y-indexeddb`, una base por sala). No restaura el host (eso es H3) | C5 |

Si al implementar falta un detalle que el diseño no fija: **parar** y actualizar este análisis; no inventar.

## 9. Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| R1 | Rehacer presencia o el relay “para la pizarra” | Reusar H1; el lienzo es consumidor del doc |
| R2 | Empezar Expo sin diseño | Puerta C0 |
| R3 | Acoplar formato interno de tldraw al resto del sistema | El traductor JSON es H4; en H2 solo sync en vivo |
| R4 | Offline mal entendido como “persistir el host” | C5 = cliente; H3 = host |
| R5 | Latencia sin número | Objetivo < 150 ms; medir en C6 |
| R6 | Contaminar orquestador con vocabulario de lienzo | Misma regla que checkpoint 4 de H1 |

## 10. Pruebas que H2 debe poder pasar

Del plan de pruebas de la arquitectura y de la fase 1:

- Convergencia: escrituras simultáneas → mismo estado.
- 2 a 10 clientes (idealmente sin navegador sobre el doc Yjs) convergen.
- Invitado se va y vuelve: sin duplicar ni perder su trabajo de lienzo.
- Sin red en el cliente: dibuja; al volver, fusiona.
- Latencia de un trazo medida y publicada.
- Typecheck / tests de los paquetes tocados en verde tras cada paso de código.

## 11. Definition of done (épica)

Aprobado en la app el 2026-11-09. El registro está en el [README de la rama](./README.md).

1. El trazo de una persona aparece en la otra por debajo del objetivo de latencia.
2. Con diez clientes el tablero converge al mismo estado.
3. Quien se queda sin red sigue dibujando y al volver no pierde nada.
4. Existe el documento de diseño Expo (C0) revisado; el lienzo de H2 vive en Vite hasta autorizar construir Expo.
5. Orquestador y contrato del relay siguen sin conceptos de pizarra.

## 12. Referencias

- [fase-1 H2](../../../fijos/fases/fase-1-modulos-y-tareas.md) (sección 5)
- [analisis-arquitectura-v2](../../../fijos/arquitectura/analisis-arquitectura-v2.md) §§6–9, 11, 12
- [analisis H0/H1](../motor/analisis-h0-h1-cimientos-y-sala.md) (D2 sala Yjs)
- [analisis-stack-powersync-react-native](../motor/analisis-stack-powersync-react-native.md) (puerta Expo)
- [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md)
- Repo Space: `/home/davesq/Documents/IoKoia/space/`
