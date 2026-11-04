# `@harukoia/web` — Web

Pantallas de H1: presencia y entrada a la sala. La sala en vivo llega por el relay. El historial se leerá de la réplica central con PowerSync, sin pasar por el relay (H4). La app de la v1 es Expo (React Native). Esta web en Vite sigue hasta que exista el diseño de esa app y se autorice construirla.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://web.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-web-dev` |
| Logs | `logs/pm2/*.log` |

Vite toma `PORT` y `HOST` del entorno en `vite.config.ts`; los asigna portless. No pases banderas de puerto.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
