# Backend de escritura (PdC)

Proceso propio (D-R2). Recibe la cola de subida y emite JWT de lectura (D-R3).

```bash
cd pruebas/replica-central
cp -n .env.example .env
# TOKEN_DE_HOST_PRUEBA y keys/local-dev.pem deben existir
cd backend-escritura
pnpm install
pnpm test
pnpm start
```

| Ruta | Qué |
|------|-----|
| `GET /health` | Vivo |
| `POST /api/data` | Batch `{ sala, batch }` + `Authorization: Bearer <token de host>` |
| `GET /sync/bootstrap` | `{ powersyncUrl, token, sala }` |

Rechazo de host → HTTP **200** con `{ ok: false, causa }` (no 4xx). Postgres caído → **503**.
