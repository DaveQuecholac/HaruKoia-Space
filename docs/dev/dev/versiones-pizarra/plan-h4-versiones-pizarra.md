# Plan de acción — H4 Versiones de la pizarra

Rama: `dev/versiones-pizarra`.  
Análisis: [analisis-h4-versiones-pizarra.md](./analisis-h4-versiones-pizarra.md).  
**Bloqueo.** La PdC cerró en R7 ([evidencia-replica-central.md](./evidencia-replica-central.md), 2026-11-17). **V0 puede empezar** cuando el chat lo confirme. No codear V* sin esa confirmación.

## Reglas de trabajo

1. Un paso → parar → verificar → pruebas.
2. Sin fallback de formatos viejos (`authorize_legacy_fallback` no aplica).
3. Almacenes separados: Yjs H3 ≠ espejo PowerSync.
4. Staging = **toda la pizarra** (D-H4-1); no implementar selección por forma.
5. Solo el host comitea; el camino real no arrastra mocks.

## Mapa

```text
(R0–R7 réplica — otro plan)
        │
V0  Contratos: commit, snapshot, versión de formato JSON
        │
V1  Traductor tablero → JSON → tablero (ida y vuelta)
        │
V2  Persistencia local del grafo de commits en el host
        │
V3  Acción de sala: staging + commit (toda la pizarra)
        │
V4  Historial en la web (lectura local / host)
        │
V5  Checkout + padre del siguiente commit
        │
V6  Cablear réplica: host sube commits reales (post-PdC)
        │
V7  Invitados leen historial por PowerSync (host apagado)
        │
V8  Compactación del Yjs vivo tras commit (si el análisis lo mantiene)
        │
V9  Resistencia, DoD, evidencia
```

---

## V0 — Contratos de dominio y esquema

**Objetivo.** Tipos e identificadores: `Identificador<'commit'>`, forma del commit (padre, mensaje, autor, participantes, fecha), referencia a snapshot/JSON, versión de formato del JSON. Tablas de esquema alineadas a v2 (`commits`, `snapshots`) con campos mínimos de H4.

**Archivos.** `packages/domain`, `packages/schema` (dueños del mecanismo). Sin UI.

**Errores.**

| Error | Mitigación |
|-------|------------|
| Campos de H5/H6 colados | Lista explícita “solo H4”; documents/attachments fuera |
| Un archivo dios de tipos | Un asunto por carpeta (model-oriented-layout) |

**Pruebas.** Unitarias de construcción/validación del commit; tipado que impida asignar `sala` a `commit`.

**Verificación.** `pnpm --filter @harukoia/domain test` y schema; typecheck. **Parar.**

---

## V1 — Traductor ida y vuelta

**Objetivo.** H4-T1, T2, T3. Dado el estado del `Y.Map` `tablero` (o el contrato que H2 fijó), producir JSON versionado y volver a cargar sin pérdida observable.

**Errores.** F-V1.

**Pruebas.**

- Fixture con N formas → JSON → reimport → igualdad profunda de lo que el lienzo necesita
- Forma desconocida en JSON nuevo: fallo explícito, no silencio
- Versión de formato distinta: rechazo claro

**Verificación.** Suite del traductor en verde. **Parar.** Humo manual en la web **no** obligatorio aún si no hay botón.

---

## V2 — Grafo de commits en el host (local)

**Objetivo.** El host guarda commits en su almacén PowerSync/SQLite de producto (o el path que la PdC adoptó), **sin** exigir réplica arriba todavía si V6 está separado. Incluye snapshot binario + JSON.

**Errores.** F-V6 (no usar `sala.sqlite` Yjs), F-V4.

**Pruebas.**

- Crear commit raíz; crear hijo; listar historial ordenado
- Leer snapshot de un id y comprobar bytes/JSON

**Verificación.** Tests del host/paquete dueño. **Parar.**

---

## V3 — Staging + commit (acción de sala)

**Objetivo.** H4-T4, T5, T8. UI mínima: mensaje + confirmar. Staging no filtra formas. Solo conexiones con rol host.

**Errores.** F-V2.

**Pruebas.**

- Entre procesos: espectador pide commit → rechazo
- Host comitea → aparece en historial local; participantes del commit = presencia al momento (regla a fijar en el paso: snapshot de nombres presentes)

**Verificación.** Prueba entre procesos + typecheck. **Parar.** Checkpoint: ver en la app (host) un commit listado.

---

## V4 — Historial en la web

**Objetivo.** H4-T6. Lista navegable (id corto, mensaje, fecha, autor). Todavía puede leer vía host/sala si V6 no está; si V6 ya sube, preferir la misma API de lectura que usarán los invitados.

**Errores.** Lista vacía confusa → estado “sin versiones” explícito.

**Pruebas.** Componente o flujo: tras V3, la web del host muestra el commit.

**Verificación.** Humo en navegador. **Parar.**

---

## V5 — Checkout

**Objetivo.** H4-T7. Elegir commit → estado de trabajo = ese snapshot; el **siguiente** commit tiene `padre` = ese id.

**Errores.** F-V3, F-V4.

**Pruebas.**

- Commit A → dibujar → commit B → checkout A → commit C → `C.padre === A`
- Tablero tras checkout A coincide con snapshot A (traductor / Yjs)

**Verificación.** Prueba automatizada del grafo + humo UI. **Parar.**

---

## V6 — Subida a la réplica central

**Objetivo.** Sustituir/usar el backend real (adoptado de la PdC) desde `apps/host`: cola PowerSync, solo host. Payload completo (D-R1).

**Errores.** F-V5.

**Pruebas.**

- Commit → fila en Postgres
- Token de no-host no escribe

**Verificación.** Criterios de la PdC aplicados al camino de producto. **Parar.**

---

## V7 — Lectura del historial con host apagado

**Objetivo.** H4-T9. Invitado (o segunda máquina) con JWT de lectura ve el historial; host detenido.

**Errores.** F-R4 / F-V5.

**Pruebas.** Entre procesos o humo documentado: commit → stop host → lector sigue listando.

**Verificación.** Evidencia en `evidencia-h4-*.md` o sección del README. **Parar.**

---

## V8 — Compactación tras commit

**Objetivo.** H3 dejó la compactación “al commitear” para H4. Tras un commit exitoso, compactar el documento Yjs vivo de forma segura (sin perder el snapshot ya guardado).

**Errores.** Compactar antes de persistir el snapshot → pérdida; orden: snapshot confirmado **después** compactar.

**Pruebas.** Commit → compactar → rearrancar host (H3) → tablero sigue; historial intacto.

**Verificación.** Test de resistencia corto. **Parar.** Si se decide no compactar en H4, anotar en el análisis y saltar sin código.

---

## V9 — Cierre H4

**Objetivo.** Definition of done de la fase 1; suites host/web/entre-procesos; typecheck; actualizar README de la rama; promover a fijos lo que falte.

**Checklist DoD.**

1. Guardar → historial → checkout → seguir dibujando  
2. Export/import JSON idéntico  
3. JSON legible en diff  
4. Padre correcto tras checkout  

**Hecho cuando.** Chat aprueba el humo en la app. **Parar.** Siguiente épica: H5 (otra rama).

---

## Qué no hace este plan

- `space update`, git push, markdown determinista (H5).
- Despliegue de la réplica en Makino Hara (salvo que el chat lo pida aparte).
- Staging por elementos/marcos.
