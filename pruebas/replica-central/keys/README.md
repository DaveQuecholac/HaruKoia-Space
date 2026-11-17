# Claves JWT de la PdC (local-dev)

- `local-dev.pem` / `local-dev.pub.pem` — par RS256 local (gitignore en `*.pem`).
- `jwks.json` — clave pública embebida también en `../service.yaml` (`kid: harukoia-pdc-local-1`).
- Si faltan los PEM: `openssl genrsa -out local-dev.pem 2048` y regenerar el JWKS (el `n` de `service.yaml` debe coincidir).
- No usar estas claves en producción ni copiar las de Space (otra `kid` / audiencia).
