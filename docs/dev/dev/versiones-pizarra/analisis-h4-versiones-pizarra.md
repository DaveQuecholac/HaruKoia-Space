# Análisis — H4 Guardo una versión y vuelvo a ella

Rama: `dev/versiones-pizarra`.  
Plan: [plan-h4-versiones-pizarra.md](./plan-h4-versiones-pizarra.md).  
Puerta previa: [analisis-replica-central.md](./analisis-replica-central.md) + PdC en verde.

## 1. Por qué esta épica

Historia (fase 1 §7):

> Marco lo que vale, guardo una versión con su mensaje, veo el historial y puedo volver a una versión anterior.

H2/H3 dan un tablero vivo que sobrevive reinicios. Todavía **no** hay versión oficial, padre, autor ni checkout. Eso es lo que inventamos aquí; no se copia de tldraw ni de git tal cual.

## 2. Qué hereda (no se reconstruye)

| Pieza | De dónde | Uso en H4 |
|-------|----------|-----------|
| Documento Yjs en SQLite del host | H3 | Estado de trabajo; el commit toma un snapshot de aquí |
| Identidad durable + keyring | H3 | Misma sala al commitear |
| Solo el host comitea | v2; roles H1 B8 | Validación en servidor (H4-T8) |
| Lienzo tldraw ↔ `Y.Map` `tablero` | H2 | Entrada del traductor JSON |
| Réplica central | PdC de esta rama | H4-T9: historial legible con host apagado |
| Tablas conceptuales `commits` / `snapshots` | v2 §5 | Campos se cierran en esta épica |

## 3. Qué entra y qué no

**Entra (H4-T1…T10):**

1. Traductor tablero ↔ JSON (formas, coordenadas, orden) con versión de formato propia.
2. Staging = intención de guardar **toda la pizarra** (mensaje + confirmación).
3. Commit: snapshot Yjs + JSON + padre + autor + participantes + fecha.
4. Historial navegable en la UI.
5. Checkout: cargar un commit como nuevo estado de trabajo; el siguiente commit cuelga de ese.
6. Solo el host comitea (servidor).
7. Historial replicado (PowerSync); invitados leen con host apagado.
8. Pruebas de ida y vuelta del traductor y del grafo de commits.

**No entra.**

| Tema | Por qué |
|------|---------|
| Ramificación | Fuera de la v1 |
| Push, markdown, CLI, git | H5 |
| IA / PDF / Word | H6 |
| Selección por elementos o marcos en staging | Aplazado; ver D-H4-1 |
| Migración de host | Fuera de la v1 |
| Construir Expo | Otra autorización |

## 4. Decisión D-H4-1 — Staging = toda la pizarra

**Decisión (2026-11-17).** Cada commit guarda una copia de **toda la pizarra** actual (estado de trabajo completo). No hay marcado por elemento ni por marco en la v1.

**Por qué encaja con el diseño.**

- El commit de la v2 ya es “snapshot + JSON del tablero” de la sesión, no un fragmento.
- El checkout carga “un commit anterior como nuevo estado de trabajo”: eso es el tablero entero.
- Elementos/marcos selectivos complican el traductor, el grafo y la UI sin desbloquear H5.
- “Staging” en la v1 = zona de **preparar el guardado** (mensaje, lista de participantes que estaban, botón de confirmar), no un subset del canvas.

**Qué queda para después.** Si el producto pide “commitear solo este marco”, será una variante del mecanismo de commit (filtro al construir snapshot/JSON), no un segundo sistema. La prueba de extensión del mecanismo lo exige así.

## 5. Mecanismo extensible (versionado)

```text
Mecanismo de la capacidad: versionar el estado de trabajo de la pizarra (staging → commit → historial → checkout)
Variantes de hoy: commit de pizarra completa (snapshot Yjs + JSON)
Variantes probables siguientes: commit filtrado por marco; adjuntos por commit (H5/H6)
Módulo dueño: packages/domain (commit, grafo) + packages/schema (filas) + apps/host (autoridad)
Plugins: traductor JSON como pieza con pruebas propias; UI de historial consume el contrato genérico
Prueba de extensión: filtro por marco = opción al crear el snapshot, sin nuevo tipo de “commit de marco” paralelo
Patrón existente: identidad tipada Identificador<'commit'>; presencia ya sella roles
```

## 6. Traductor (M9)

| Forma | Para qué |
|-------|----------|
| Snapshot Yjs (`Uint8Array` / encoded state) | Volver a abrir la sesión / checkout fiel |
| JSON de formas y coordenadas | Diff en git más adelante; archivo entendible |

Versión de formato **propia**, independiente del JSON interno de tldraw (H4-T3). Si tldraw cambia, el traductor aísla el golpe.

Pruebas propias: export → import → igualdad observable del tablero (H4-T10).

## 7. Grafo de commits

- Cada commit tiene `padre` (nullable en el primero).
- Checkout **no reescribe** historial: trae el snapshot al estado de trabajo; el **siguiente** commit tiene por padre el commit chequeado.
- Solo el host crea commits; el backend de la réplica ya rechaza no-hosts (PdC); el host valida la acción de sala igual que `cambiar-invitacion`.

## 8. Relación con la réplica (D-R1)

Al commitear, el host escribe en su SQLite PowerSync (producto, post-PdC) y la cola sube metadatos + snapshot + JSON. Los invitados leen historial por PowerSync. El documento Yjs vivo de H3 **sigue** siendo el estado de trabajo; no se reemplaza por el espejo.

**Cerrado en chat (2026-11-18) para V6.** Backend de escritura en `apps/backend-escritura`; espejo del host con `@powersync/node`; Postgres `commits`/`snapshots`; token de host en `.env` de desarrollo. Inspiración Space: estación compose + bootstrap JWT; **no** Nest como autoridad (el host alimenta).

## 9. Errores previstos (H4)

| Código | Qué pasa | Qué hacemos |
|--------|----------|-------------|
| F-V1 | Traductor pierde una forma | Prueba de ida y vuelta falla; no se mergea |
| F-V2 | Espectador intenta commitear | Rechazo en host; UI no ofrece o muestra causa |
| F-V3 | Checkout con commit inexistente | Error visible; estado de trabajo no cambia |
| F-V4 | Commit sin padre cuando debería colgar | Grafo inválido; prueba de grafo |
| F-V5 | Réplica caída al commitear | Commit local OK; estado “pendiente de subir” (UI mínima o log); cola reintenta |
| F-V6 | Mezclar escritura de commit en `sala.sqlite` Yjs | Prohibido; almacenes separados |
| F-V7 | Compactar Yjs al commitear | Permitido aquí (H3 dejó compactación “al commitear” para H4): tras snapshot estable, se puede compactar el doc vivo sin perder el commit |

## 10. Tensiones / abiertos que H4 no cierra

| Tema | Estado |
|------|--------|
| Si git entra en el alcance inicial | Sigue abierto; no bloquea traductor/staging/commit local; sí la forma de H5 |
| `space update` desde git o réplica | H5 |
| UI detallada de “pendiente de subir” | Mínimo viable en H4; pulir con H5 |

## 11. Definition of done (fase 1)

1. Se guarda, se ve el historial, se vuelve a una versión y se sigue trabajando desde ahí.
2. Un tablero exportado y reimportado es idéntico.
3. El archivo JSON se entiende en un diff de git (aunque el push sea H5).
4. El commit después de un checkout cuelga del commit correcto.
