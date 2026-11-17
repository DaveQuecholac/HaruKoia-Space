# Análisis — Réplica central (antes de H4)

Rama: `dev/versiones-pizarra`.  
Plan: [plan-replica-central.md](./plan-replica-central.md).  
H4: [analisis-h4-versiones-pizarra.md](./analisis-h4-versiones-pizarra.md).

## 1. Por qué esta rebanada ahora

H3 dejó el documento Yjs vivo en el disco del host. H4 necesita que el **historial de commits** se lea con el host apagado. Eso no pasa por el relay: pasa por la **réplica central** (Postgres, PowerSync Service, backend de escritura).

La fase 1 y la v2 lo ponen **antes de H4**, no dentro del producto a ciegas: [plan-pdc-stack-powersync-react-native.md](../motor/plan-pdc-stack-powersync-react-native.md). Esta prueba **no es producto**: no toca `apps/web`, `apps/host` ni `apps/orchestrator`. Al terminar se anota el resultado y se borra lo que no se adopte.

## 2. Qué ya está decidido (no se reabre)

| Decisión | Dónde |
|----------|--------|
| PowerSync Open Edition autoalojado + SDKs | v2; análisis stack |
| Solo el host alimenta la réplica | v2 §4–5 |
| La réplica **no** pasa por el relay | v2 §6 |
| RxDB fuera | arquitectura-harukoia / stack |
| El documento Yjs de H3 es **otro** almacén; no se mezcla con el espejo PowerSync | referencia Space §6 |
| Compose, buckets Postgres, JWT RS256: partir de Space, no reinventar | referencia Space §4 |

## 3. Qué hereda de Space (patrón, no código)

Repo hermano: `/home/davesq/Documents/IoKoia/space/` — `apps/server/deploy/powersync/`.

| Pieza | Default Space | En HaruKoia |
|-------|---------------|-------------|
| Postgres | 16+, `wal_level=logical` | Igual |
| Imagen | `journeyapps/powersync-service:1.27` | Pinnear la misma línea salvo que la PdC demuestre otra |
| Buckets | DB `powersync_storage`, sin Mongo | **Adoptado (D-R4)** |
| Sync config | Edition 3 | Igual en la PdC |
| Auth sync | JWT RS256; bootstrap HTTP | **Adoptado (D-R3)**; emisor distinto (backend de escritura, no Nest) |
| SDK harness | `@powersync/node` | Host de prueba y lector de prueba |

## 4. Decisiones cerradas (2026-11-17)

### D-R1 — Qué sube a la réplica

**Decisión.** Suben **metadatos del commit** (id, padre, mensaje, autor, participantes, fecha) **y** el **snapshot Yjs** **y** el **JSON del tablero**.

**Por qué.** La tabla `snapshots` de la v2 ya los nombra. H4-T9 pide historial con el host apagado; sin snapshot el invitado ve títulos y no puede reconstruir el tablero. Solo metadatos dejaría H4 a medias y obligaría a reinventar el transporte en H5.

**Consecuencia.** El tablero versionado vive también en la nube (copia de lectura). El sync en vivo sigue siendo solo Yjs por el relay; no se dibuja contra Postgres.

### D-R2 — Dónde vive el backend de escritura

**Decisión.** **Proceso propio** dentro del grupo de la réplica central. **No** dentro del orquestador.

**Por qué.** El orquestador no guarda datos de sala (diseño vigente). Meterle escritura a Postgres cambia su papel y acopla relay con réplica. Cumple el criterio de proceso propio: guarda datos que el relay no debe tocar, y su caída no debe tumbar el enrutamiento ([por-que-no-microservicios.md](../../../fijos/arquitectura/por-que-no-microservicios.md)).

**En la PdC.** Un servidor mínimo desechable (Node) que implementa `uploadData` del contrato de PowerSync: escribe en Postgres de forma síncrona y rechaza a quien no presente el token de host de esa sala.

### D-R3 — Quién emite el token de lectura

**Decisión.** El **backend de escritura** (mismo proceso o ruta hermanada) emite un **JWT RS256** de lectura para PowerSync, con alcance de **sala**. En la PdC: claves `local-dev` en disco, como Space. Autenticación de producto (Bearer real, invitación como prueba) queda fuera; la PdC mide el cableado, no el IAM.

**Por qué.** Space ya demostró JWT + JWKS embebido en `service.yaml`. Separar un emisor distinto del orquestador evita que el relay conozca PowerSync. El token de **host** (escritura) no es el de lectura: escritura = prueba de host de la sala; lectura = JWT de sync con claim de sala.

### D-R4 — Almacén de buckets

**Decisión.** **Postgres** `powersync_storage` en el mismo host Docker que el Postgres de app, **sin Mongo**.

**Por qué.** Space lo cerró así; menos piezas, un solo volumen que operar.

### D-R5 — Reglas H0 vs PowerSync

**Decisión.**

| Capa | Regla |
|------|--------|
| Espejo PowerSync (clientes) | Client schema → views. **Prohibido** migrar el archivo `powersync-*.db` con el pipeline de H0 |
| Postgres (fuente) | Migraciones versionadas del esquema de réplica |
| Documento Yjs de H3 | Sigue en su SQLite (`sala.sqlite` / extensión Hocuspocus). **No** es tabla sync |
| Dominio en `packages/schema` | Identificadores tipados y borrado lógico siguen para entidades de dominio; el orden `actualizadoEn` lo pone el **host** al escribir. No se aplica “migrar al leer” sobre el espejo |

## 5. Mecanismo (capacidad extensible)

```text
Mecanismo de la capacidad: subir escrituras del host a una copia central de lectura y repartirlas a lectores
Variantes de hoy: commit de pizarra (metadatos + snapshot + JSON)
Variantes probables siguientes: documents (markdown), attachments, estado de push (H5/H6)
Módulo dueño: réplica central (Postgres + sync rules + backend de escritura); contrato en packages/schema cuando entre producto
Plugins: cada colección sync es un stream / tabla; el backend valida host una sola vez
Prueba de extensión: agregar documents = tabla + stream + campos en client schema, sin segundo backend
Patrón existente a extender: Space deploy/powersync + uploadData; HaruKoia no importa Nest
```

## 6. Dónde vive la prueba (layout)

| Qué | Dónde |
|-----|--------|
| Compose Postgres + PowerSync + init | `pruebas/replica-central/` (raíz). **No** bajo `apps/`: el arranque de la raíz no debe tratarlo como producto |
| Backend de escritura de la PdC | `pruebas/replica-central/backend-escritura/` |
| Host harness (`@powersync/node`) | `pruebas/replica-central/host-harness/` |
| Lector (página o script Node) | `pruebas/replica-central/lector/` |
| Evidencia | `docs/dev/dev/versiones-pizarra/evidencia-replica-central.md` al cerrar |

Al adoptar: se mueve o se reescribe hacia el layout de producto que fije H4/H5; lo desechable se borra.

## 7. Errores previstos (réplica)

| Código | Qué pasa | Qué hacemos |
|--------|----------|-------------|
| F-R1 | Backend rechaza escritura del host | Revertir en el host en el siguiente checkpoint; causa visible en log (v2 §10) |
| F-R2 | Alguien sin token de host intenta escribir | Rechazo; el lector no ve esa fila |
| F-R3 | Host sin red | Cola local; al volver sube sola |
| F-R4 | Host apagado | Lectores siguen viendo lo ya replicado |
| F-R5 | PowerSync o Postgres caídos | Sala en vivo sigue (relay). Historial remoto no avanza; el host lo dice cuando exista UI |
| F-R6 | Token de lectura caducado o sala equivocada | Sync no arranca o no ve filas de otra sala |
| F-R7 | Mezclar Yjs H3 con espejo PowerSync | Prohibido; la PdC usa tablas de commit de prueba, no el archivo `sala.sqlite` |

## 8. Criterios de la PdC (heredados y cerrados)

| # | Pasa si |
|---|---------|
| 1 | El host escribe sin red y la cola sube al volver |
| 2 | Un cliente sin el token de host no puede escribir |
| 3 | El lector ve el commit (metadatos + payload de prueba) sin pasar por el relay |
| 4 | Apagar el host no le quita el historial a quien lo lee |
| 5 | Un rechazo del backend se revierte en el host y deja la causa visible |

**Se mide.** Tiempo de un commit hasta que lo ve el lector; memoria de los contenedores en reposo.

## 9. Qué no entra en la PdC

- Esquema final de producto de H4 (solo tablas de prueba suficientes para los criterios).
- Cablear `apps/host` real.
- Makino Hara / Coolify.
- Autenticación real.
- App Expo.
- Staging/UI de versiones (eso es H4).
