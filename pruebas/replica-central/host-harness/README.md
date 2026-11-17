# Host harness (PdC R4)

Escribe un commit de prueba en SQLite PowerSync bajo `../tmp/` y lo sube a `backend-escritura`.

```bash
cd pruebas/replica-central/host-harness
pnpm run install:pdc   # incluye download_core.js si faltan binarios
pnpm test
# backend en :18091 y PowerSync/Postgres arriba
pnpm run escribir
```

Si falla al abrir la DB por binarios core: `node node_modules/@powersync/node/download_core.js`.

`better-sqlite3` no se instala en esta carpeta: el worker carga el de `apps/host` (ya compilado en el monorepo). Así la PdC no exige `make`/gyp en la máquina.
