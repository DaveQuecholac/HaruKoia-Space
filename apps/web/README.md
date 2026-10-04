# `@harukoia/web` — Web

Pizarra, presencia y lectura local de lo publicado. Base local en el navegador; se replica contra el contenedor host a través del relay.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://web.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-web-dev` |
| Logs | `logs/pm2/*.log` |

Vite toma `PORT` y `HOST` del entorno en `vite.config.ts`; los asigna portless. No pases banderas de puerto.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
