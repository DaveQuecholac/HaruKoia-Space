# Plan de acción — H2 Pizarra colaborativa

Rama: `dev/pizarra-colaborativa`.  
Análisis: [analisis-h2-pizarra-colaborativa.md](./analisis-h2-pizarra-colaborativa.md).

## Reglas de trabajo

1. **Un paso → parar → verificar → pruebas del paso.** No se encadenan pasos de código sin checkpoint.
2. Ningún paso se da por terminado solo porque “compila”.
3. Las decisiones E1–E5 del análisis se confirman **antes** del paso que las necesita.
4. Si el diseño no define algo, **detenerse** y actualizar el análisis. No inventar.
5. Nada de esta rama toca H3–H7 ni el orquestador como dueño de pizarra.

## Mapa

```text
P0  Cierre H1 en docs + esta carpeta de rama
        │
        ▼
C0  Diseño app Expo (PUERTA — sin código de lienzo)
        │
        ▼  checkpoint: diseño confirmado en el chat
C1  Dependencias y andamio del lienzo en apps/web
        │  verificar: typecheck / smoke montaje vacío
C2  Binding tldraw ↔ documento Yjs de la sala
        │  verificar: un trazo cruza entre dos clientes (mínimo)
C3  Dos personas dibujando sin candados
        │  verificar: convergencia automatizada
C4  Cursores y selección ajena
        │  verificar: presencia de lienzo visible
C5  Offline en cliente + fusión al volver
        │  verificar: prueba sin red
C6  Latencia medida + cierre H2
        │  verificar: < 150 ms + DoD
```

---

## P0 — Cierre documental de H1 y arranque de esta rama

**Objetivo.** Dejar explícito que H1 está cerrada en código (solo restaba checklist humano) y que el trabajo vivo es H2 en `dev/pizarra-colaborativa`.

**Archivos.** Este plan, el análisis, el README de la rama; actualización de estado en `docs/dev/dev/motor/README.md`.

**Verificación.**

- `git branch --show-current` → `dev/pizarra-colaborativa`
- Existe `docs/dev/dev/pizarra-colaborativa/` con README, análisis y plan
- El README de `dev/motor` marca H1 como cerrada en código

**Hecho cuando.** Lo anterior es verdad. **No** hay código de producto en este paso.

---

## C0 — Diseño de la app Expo (puerta)

**Objetivo.** Escribir el diseño que la arquitectura exige **antes** de construir el lienzo: pantallas, lienzo (tldraw en DOM), arranque PM2/portless, qué queda en Vite en H2, límites móvil (no host local). Apoyarse en [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md) y en el repo Space para Metro, SQLite RN y secrets — **sin** implementar Expo aquí.

**Archivos.** `docs/dev/dev/pizarra-colaborativa/diseno-app-expo.md` (nombre fijo de este plan).

**Verificación.**

- El documento responde las preguntas de la sección 4 del análisis
- No inventa stack distinto a Expo + tldraw en DOM
- Deja explícito: H2 implementa lienzo en `apps/web`; construir Expo es otra autorización

**Hecho cuando.** El documento existe y el usuario confirma en el chat: *“C0 ok, seguimos”*.

**Prohibido después de C0 sin esa confirmación:** `Write`/`StrReplace` en `apps/**` o `packages/**` para el lienzo.

---

## C1 — Andamio del lienzo en la web

**Objetivo.** Montar tldraw en la pantalla de sala **sin** sync aún (lienzo local vacío o de humo), para aislar problemas de layout/deps del problema de sync.

**Depende de.** C0 confirmado. La pantalla de este paso se aprueba en Open Design (proyecto `harukoia-sala-c1`) antes de editar `apps/web`. Decisión E2 (versión/paquete) anotada en el análisis o en este paso.

**Archivos (esperados).** Zona de sala en `apps/web` (p. ej. bajo `sala/`), dependencias vía `pnpm` en el paquete web. **No** tocar orquestador.

**Verificación.**

```bash
pnpm typecheck
# humo: abrir sala, ver el lienzo montado a pantalla usable
```

**Hecho cuando.** Un host (o espectador) ve el lienzo en la sala; sin sync colaborativo todavía.

| Error previsto | Cómo se evita |
|----------------|---------------|
| El lienzo no llena el viewport | API/estilos documentados de tldraw + contenedor existente; sin envoltorios inventados |
| Dependencia mal resuelta en monorepo | Instalar con pnpm del repo; no editar lock a mano |

---

## C2 — Conectar el lienzo al documento Yjs de la sala

**Objetivo.** El mismo `Y.Doc` (o fragmento E3) que ya usa Hocuspocus alimenta tldraw. Un trazo en un cliente aparece en otro.

**Depende de.** E2 y E3 confirmados. Docs oficiales del binding (no espeleología en `node_modules`).

**Archivos.** Binding en el dueño M8 (web/capa de pizarra); reutilizar `conexion-a-la-sala` / cliente-del-relay. Cero lógica de formas en orquestador.

**Verificación.**

1. Dos navegadores (o un test con dos proveedores Yjs) en la misma sala
2. Trazo en A → visible en B
3. `pnpm test` de lo tocado en verde
4. Grep de control: orquestador sin símbolos de tldraw/pizarra

**Hecho cuando.** Sync de formas funciona sobre el relay existente.

| Error previsto | Cómo se evita |
|----------------|---------------|
| Segundo WebSocket “solo para el lienzo” | Un solo camino de sala; el lienzo es consumidor del doc |
| Pisarse el awareness de nombre de H1 | Extender awareness; no reemplazar el canal de presencia |

**Checkpoint.** Demostración mínima A↔B antes de C3.

---

## C3 — Convergencia con dibujo simultáneo

**Objetivo.** Varias escrituras a la vez sin candados; el tablero converge (H2-T3).

**Verificación.**

- Prueba automatizada: N clientes Yjs (2…10 si aplica el andamiaje de H1) escriben y convergen al mismo estado
- Humo manual: dos personas trazando a la vez sin “último gana” destructivo

**Hecho cuando.** La prueba de convergencia pasa en la máquina de cualquiera de los dos.

---

## C4 — Cursores y selección ajena

**Objetivo.** Ver cursor y selección de los demás con nombre (H2-T4 / M7).

**Verificación.**

- Humo: dos usuarios; el cursor de B se mueve en A con el nombre correcto
- Al salir B, su cursor desaparece (misma semántica de presencia que H1)

**Hecho cuando.** Conciencia espacial del lienzo usable; sin punto anónimo.

---

## C5 — Sin red en el cliente y fusión al volver

**Objetivo.** Offline de **cliente** (H2-T5): seguir dibujando; al reconectar, fusionar. No es persistencia del host (H3).

**Depende de.** E5 entendida: IndexedDB / log Yjs en el navegador según arquitectura v2.

**Verificación.**

1. En sala, cortar red del invitado (DevTools offline o equivalente)
2. Dibujar varios trazos
3. Volver online → trazos presentes en ambos, sin duplicar de forma absurda ni perder el trabajo local
4. Prueba automatizada equivalente si el andamiaje lo permite

**Hecho cuando.** Los tres puntos del DoD offline se cumplen en humo (y test si existe).

| Error previsto | Cómo se evita |
|----------------|---------------|
| “Guardar en SQLite del host” en este paso | Eso es H3; aquí solo cliente |
| Perder trabajo sin aviso | Si no se puede fusionar, la UI lo dice (mismo criterio de conciencia que H1) |

---

## C6 — Latencia y cierre de H2

**Objetivo.** Medir latencia de un trazo (H2-T6), contrastar con < 150 ms (misma región), cerrar la épica.

**Verificación.**

```bash
pnpm typecheck
pnpm test
```

- Número de latencia publicado en el README de la rama (método + resultado)
- Recorrer DoD del análisis §11
- Confirmación: orquestador limpio de vocabulario de pizarra

**Hecho cuando.** DoD de H2 cumplido y anotado en el README de esta rama (estado de pasos en verde).

**Checkpoint final.** Demostración entre dos máquinas (idealmente redes distintas, mismo orquestador): dibujar, cursores, un corte de red corto y fusión.

---

## Fuera de este plan (no mezclar)

- H3 restauración del host
- H4 traductor / commits
- PdC de réplica PowerSync (antes de H4, otra carpeta/rama)
- Implementar `apps` Expo (solo diseño en C0)

## Después de H2

Siguiente épica documentada: **H3 — Cierro la laptop y la sala vuelve**. Antes no se abre H4.
