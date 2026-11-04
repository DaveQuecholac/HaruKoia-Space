# Referencia desde IOKOIA Space — PowerSync, SQLite y secrets

HaruKoia va a usar **PowerSync**, **SQLite en web / móvil / desktop** y un **almacén seguro de strings** (tokens, claves). Eso ya está implementado y documentado en el monorepo hermano:

| | |
|---|---|
| Repo | `/home/davesq/Documents/IoKoia/space/` (remoto `iokoia/space`) |
| Rol | Producto Space (Nest + clientes Expo / web / Tauri). **No** se modifica desde este motor |
| Este archivo | Resumen de decisiones y formas que **sí** conviene reutilizar aquí |

**Cuando lleguemos a construir** la réplica, la app Expo o el paquete de secretos: **abrir ese repo** y leer el código y los reqs citados abajo. Este documento no sustituye el detalle; evita reinventar lo que Space ya cerró.

La arquitectura vigente de **este** motor sigue siendo [analisis-arquitectura-v2.md](./arquitectura/analisis-arquitectura-v2.md). Space no cambia el patrón host-autoritativo.

---

## 1. Qué se reutiliza y qué no

| Pieza de Space | ¿Entra en HaruKoia? | Notas |
|---|---|---|
| Seam SQLite multi-runtime (`@iokoia/space-sqlite`) | **Sí, el patrón** | Mismos motores por plataforma. El paquete de HaruKoia se diseña aquí; no se importa el de Space sin decisión |
| Secrets abstractos (`@iokoia/space-secrets`) | **Sí, el patrón** | Misma API y mismos backends |
| PowerSync self-hosted + Postgres + JWT | **Sí, el patrón de estación** | Compose, `wal_level=logical`, buckets en Postgres, bootstrap con token |
| Evolución de esquema en device (views PowerSync, no Drizzle en el espejo) | **Sí** | Cierra casi del todo el punto abierto S8 de H0 |
| Sync runtime en el shell (singleton / líder) | **Sí** | No atar sync al montaje de una pantalla |
| Separar SQLite de device, espejo PowerSync y system DB | **Sí** | Tres roles distintos |
| Nest como SoT de datos de producto; mutaciones solo HTTP Nest | **No tal cual** | En HaruKoia el **host** es la autoridad de la sala y el único que alimenta la réplica. El backend de escritura de HaruKoia no es Nest de Space |
| Registry multi-server en el device (árbol 8) | **Solo si el producto lo pide** | Space conecta a varias estaciones. HaruKoia v1 es sala + orquestador + réplica central |
| Multi-BD lógica `app` / `repo_*` | **No en la v1 del motor** | Es modelo de Space por repositorio. La réplica de HaruKoia se diseña en su propio documento |

---

## 2. SQLite en todos los entornos (árbol 6)

### Decisión

Un paquete compartido con **exports por runtime**. Smoke mínimo: `SELECT 1`. Luego `openAppDatabase()` para la DB de app del device (registry, etc.).

| Runtime | Motor | Cómo lo hizo Space |
|---|---|---|
| React Native / Expo | `expo-sqlite` | `exports["react-native"]` |
| Browser (web) | `sql.js` (WASM) | CDN: fijar `sql-wasm.wasm` (el CDN no publica el nombre `sql-wasm-browser.wasm`) |
| Desktop (Tauri / Vite) | `sql.js` | Alias Vite al entry desktop; **wasm local** (`?url`), no el CDN del browser |
| Node (server / CI) | `better-sqlite3` | Archivo o memoria según el caso |

Fuente: `docs/reqs/6-*.req.md`, `packages/sqlite/README.md`, procedure `procedures/init-sqlite-all-envs-v1.procedure.md`.

### Lecciones al cablear

- **Metro (mobile):** pinnear packages del workspace y, si hace falta, desactivar `unstable_enablePackageExports` para que no resuelva el entry `node` por error.
- Dependencias nativas Expo: **siempre** `npx expo install` / `expo install --check` contra el SDK host. No pinchar majors a ciegas.
- El smoke del server en Space es `GET /health/sqlite`. En HaruKoia el host/orquestador pueden tener health distinto; el patrón es “endpoint o script que demuestra el motor”.

### Cuándo mirar Space

Al diseñar el paquete SQLite de HaruKoia (antes o junto a la app Expo y a la PdC de réplica):

- `packages/sqlite/src/{native,web,desktop,node}.ts`
- `procedures/init-sqlite-all-envs-v1/docs/`

---

## 3. Almacenamiento seguro de strings (árbol 7)

### Decisión

API única; el dominio **no** conoce Keystore ni IndexedDB.

```ts
type SecretsStore = {
  readonly backend: string;
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
};
```

| Cliente | Backend | `backend` reportado |
|---|---|---|
| Mobile (Expo) | `expo-secure-store` | `expo-secure-store` |
| Web | Web Crypto AES-GCM, clave no exportable en IndexedDB; valor cifrado | `webcrypto-idb` |
| Desktop (Tauri) | OS keyring vía comandos Rust (`keyring`) | `os-keyring` |
| Node / CI | memoria | solo smoke de agente |

Fuente: `docs/reqs/7-*.req.md`, `packages/secrets/README.md`, `procedures/init-secure-secrets-v1.procedure.md`.

### Lecciones

- **Web no es Keystore.** XSS en el mismo origen puede llamar a la API y leer secretos. Mitigar XSS; no vender el store web como cofre frente a script inyectado.
- **Desktop:** el crate `keyring` necesita features de plataforma (`sync-secret-service`, `apple-native`, `windows-native`). Sin ellas, keyring 3 usa un mock y el get falla tras el set.
- **Desktop no reusa el adaptador web** como camino oficial.
- En Space, la **API key nunca va en columnas SQLite** del registry: metadata en SQLite, secreto en secrets indexado por `serverId` (árbol 8 + 7). Mismo criterio para HaruKoia: tokens de host / invitación / JWT no viven en texto claro en SQLite de device.

### Cuándo mirar Space

Al diseñar secrets en la app Expo / web / desktop de HaruKoia:

- `packages/secrets/`
- `procedures/init-secure-secrets-v1/docs/`
- Demo UI: `packages/misc` (`SecretsDemo`)

---

## 4. Persistencia y PowerSync (árbol 11)

### Modelo de Space (para no confundirlo con HaruKoia)

| Rol | Motor | Sync |
|---|---|---|
| System (API keys, infra) | SQLite solo en el server (`SPACE_SERVER_DB`) | **No** |
| Aplicación (SoT) | Postgres en la estación | **Sí**, vía PowerSync |
| Espejo en cliente | SQLite del SDK PowerSync, un store por `serverId` | Lectura; mutaciones de dominio por HTTP Nest |
| Registry / secrets en device | SQLite + secrets locales | **No** se mezclan con el espejo |

En HaruKoia el análogo conceptual es:

| Rol HaruKoia | Análogo Space | Diferencia |
|---|---|---|
| SQLite del host (PowerSync Node) | SoT que escribe el producto | Aquí escribe el **host**, no Nest |
| Réplica central (Postgres + PowerSync Service + backend de escritura) | Postgres + PowerSync de la estación | Solo el host alimenta; invitados solo leen |
| Espejo en web / Expo | `@iokoia/space-sync` | Mismo SDK; otra autoridad de escritura |
| System / device-local | Registry + secrets | Igual idea: no va a sync rules |

### Defaults que Space ya cerró (útiles para la réplica de HaruKoia)

| Pieza | Default en Space |
|---|---|
| Postgres | 16+, `wal_level=logical` |
| Imagen PowerSync | `journeyapps/powersync-service` (pin **1.27** en el compose de Space) |
| Almacén de buckets | **Mismo host Postgres**, database `powersync_storage` — **sin Mongo** |
| Sync config | Edition **3** (`sync-config.yaml`), no el legacy `sync_rules` como primario |
| Auth sync | Nest emite JWT **RS256**; cliente hace `GET /sync/bootstrap` con Bearer y recibe `{ powersyncUrl, token }` |
| JWKS | Servido por Nest y/o embebido en `service.yaml` para local-dev |
| SDK mobile | `@powersync/react-native` + `@op-engineering/op-sqlite` **≥17.1 &lt;19** (Space pinneó `18.2.5` con Expo 57). Rebuild Dev Client |
| SDK web / desktop | `@powersync/web` |
| SDK harness Node | `@powersync/node` (+ `download_core.js` si faltan binarios) |
| Partición local | Un archivo / store por estación: `powersync-<serverId>.db` |
| Al desconectar | Conservar archivos locales; borrar solo al quitar el server del registry |
| Compose | `apps/server/deploy/powersync/` (puertos locales Space: Postgres `:54329`, PowerSync `:18080`) |

Fuente: `docs/reqs/11-*.req.md`, `procedures/powersync-postgres-v1/docs/`, `apps/server/deploy/powersync/README.md`.

### Sync runtime (11.8) — regla de producto

1. El ciclo de vida del sync es del **shell** de la app, no de Settings.
2. Settings (o equivalente) solo muta “conectado” / credenciales y notifica.
3. **Una** conexión PowerSync por estación por cliente (líder). Multi-ventana: líder con `navigator.locks` (web) o singleton de proceso (móvil).
4. Desmontar la pantalla de settings **no** corta el sync.
5. Sync con la app **totalmente cerrada** queda fuera de la v1 de Space (y no hay que inventarlo aquí).

Reglas Cursor en Space: `.cursor/rules/sync-runtime-shell-singleton.mdc`, `.cursor/rules/domain-drizzle-powersync.mdc`.

### Mutaciones vs lectura (árbol 13, transferable como disciplina)

En Space: **toda** escritura de dominio de aplicación pasa por el server; el cliente **no** hace `INSERT` local en tablas del espejo como SoT.

En HaruKoia: la escritura que alimenta la réplica central es la cola del **host** hacia el backend de escritura. Los invitados y la app de lectura **no** escriben en Postgres. Misma disciplina, otro dueño.

---

## 5. Evolución de esquema en el device (14.6) — respuesta a S8

Space documentó cómo funciona PowerSync (hecho de plataforma):

1. El protocolo sync es **schemaless** (filas como JSON).
2. En el device, los datos viven en tablas internas; la app consulta **VIEWS** derivadas del **client schema** (`new Schema({…})`).
3. Cambiar el client schema en un release de la app actualiza esas views al abrir. **No** hace falta `ALTER TABLE` / migraciones Drizzle sobre el `powersync-*.db` syncado.
4. Columnas que el schema viejo no declara se guardan pero no se exponen hasta el release nuevo.

| Capa | Herramienta | Evolución |
|---|---|---|
| Postgres (fuente) | Migraciones versionadas (en Space: Drizzle) | En la estación / réplica |
| Espejo sync (clientes) | PowerSync `Schema` | Declarativo con el release de la app |
| Tablas solo-locales (no sync) | SQL local explícito | **No** mezclar con tablas sync |

**Prohibido** (Space y conviene igual aquí): pipeline de migraciones apuntando al archivo del espejo PowerSync.

Las reglas de H0 en HaruKoia (`actualizadoEn`, borrado lógico, migrar al leer en `packages/schema`) se fijaron antes de PowerSync. Al diseñar la réplica: **partir de 14.6**. Lo local-only (p. ej. documento Yjs de H3) sigue siendo otro almacén; no se mezcla con el espejo.

Docs oficiales que cita Space: [Implementing Schema Changes](https://docs.powersync.com/maintenance-ops/implementing-schema-changes).

---

## 6. Separación de almacenes (ley operativa)

```text
1. Secrets          → API abstracta (Keystore / WebCrypto / keyring). Nunca columna SQLite en claro.
2. Device SQLite    → registry, preferencias locales. Motor: expo-sqlite / sql.js / better-sqlite3.
3. Espejo PowerSync → historial / datos replicados. SDK PowerSync. Otro path / otro nombre de archivo.
4. System SQLite    → solo infra del proceso servidor (si existe). Fuera de sync rules.
5. Postgres         → fuente que PowerSync lee (en HaruKoia: réplica central).
```

Mezclar 2 y 3 en el mismo archivo es el anti-patrón que Space prohibió explícitamente.

---

## 7. Mapa de rutas en Space (consulta al construir)

| Tema | Rutas |
|---|---|
| Lineamientos (persistencia + secrets) | `docs/lineamientos.md` § tiempo real / SQLite / Postgres / PowerSync; § credenciales |
| Reqs SQLite | `docs/reqs/6*.req.md` |
| Reqs secrets | `docs/reqs/7*.req.md` |
| Reqs PowerSync / multi-BD / runtime | `docs/reqs/11*.req.md` |
| Esquema en device | `docs/reqs/14.6-evolucion-esquema-cliente-powersync.req.md` |
| Mutaciones solo server | `docs/reqs/13.2-mutaciones-solo-nest.req.md` |
| Package SQLite | `packages/sqlite/` |
| Package secrets | `packages/secrets/` |
| Package sync | `packages/sync/` |
| Compose Postgres + PowerSync | `apps/server/deploy/powersync/` |
| Procedure SQLite | `procedures/init-sqlite-all-envs-v1*` |
| Procedure secrets | `procedures/init-secure-secrets-v1*` |
| Procedure PowerSync | `procedures/powersync-postgres-v1*` |
| Procedure sync runtime | `procedures/sync-runtime-global-v1*` |
| Rules agente | `.cursor/rules/domain-drizzle-powersync.mdc`, `sync-runtime-shell-singleton.mdc` |

---

## 8. Cómo encaja con el plan de HaruKoia

| Paso de HaruKoia | Qué traer de Space |
|---|---|
| Diseño de la app Expo (antes de H2) | Motores SQLite RN; secrets `expo-secure-store`; Metro / `expo install`; op-sqlite + PowerSync RN cuando toque sync |
| Diseño de la réplica (antes de H4) | Compose, buckets en Postgres, JWT bootstrap, sync_config edition 3, separación system/app, 14.6 |
| Prueba de la réplica | `sync:smoke` / harness Node; `GET /sync/bootstrap` como forma; no copiar Nest entero |
| Paquete secrets de HaruKoia | Contrato 7.1 + tres adaptadores |
| Paquete o seam SQLite de HaruKoia | Contrato 6.1 + tabla de motores |

Puntos abiertos de la v2 que Space **ya resolvió en su producto** (referencia, no cierre automático aquí):

| Abierto HaruKoia | Qué hizo Space |
|---|---|
| Almacén de buckets | Postgres `powersync_storage` en el mismo host |
| Quién emite el token de lectura | Nest tras Bearer de API key → JWT RS256 |
| Reglas de esquema H0 vs PowerSync | Client schema / views; no migrar el espejo con Drizzle |

Al escribir el diseño de la réplica de HaruKoia, **partir de esa tabla** y decidir qué se adopta tal cual y qué cambia porque el host es la autoridad.

---

## 9. Fuera de este traslado

- Copiar paquetes npm de Space al monorepo del motor (eso es una rebanada de código, con propuesta y OK).
- Traer el modelo multi-server completo, conversaciones, o Drizzle/`defineAppDomain` hasta que una épica de HaruKoia lo pida.
- Sustituir la v2 ni el orden H0–H7.
