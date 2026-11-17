# Lector (PdC R5)

Lee `commits_prueba` por PowerSync. **No** usa el orquestador ni el relay.

```bash
cd pruebas/replica-central/lector
pnpm run install:pdc
pnpm test
# backend + PowerSync arriba; opcional COMMIT_ID=cmt_pdc_r4_…
pnpm run leer
```
