# `@harukoia/cli` — CLI `space`

Binario de la máquina del developer. No es un proceso de PM2.

## Comandos (v1 / D-H5-3)

| Comando | Qué hace |
|---------|----------|
| `space host` | Arranca el contenedor host con cwd = este checkout (liga sala↔repo, D-H5-4). Fuera de un repo git falla. |
| `space status` | Rama local vs `origin` (adelante/atrás) y conteo de `harukoia/publicado/` |
| `space update` | `git pull` del remoto del proyecto (D-H5-2); deja los generados en el working tree |

```bash
pnpm --filter @harukoia/cli space -- --help
pnpm --filter @harukoia/cli space -- status
pnpm --filter @harukoia/cli space -- update
# o desde el checkout del proyecto, con el bin en PATH / pnpm exec:
pnpm exec space status
```

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md). Plan H5: [plan-h5-publicaciones-pizarra.md](../../docs/dev/dev/publicaciones-pizarra/plan-h5-publicaciones-pizarra.md).
