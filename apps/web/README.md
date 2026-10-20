# `@harukoia/web` — Web

Pizarra, presencia y lectura local de lo publicado. La sala en vivo llega por el relay. El historial y los estados del push se leerán de la réplica central con PowerSync, **sin** pasar por el relay (H4). Si la web se queda en Vite o pasa a Expo lo decide la prueba de concepto de React Native.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://web.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-web-dev` |
| Logs | `logs/pm2/*.log` |

Vite toma `PORT` y `HOST` del entorno en `vite.config.ts`; los asigna portless. No pases banderas de puerto.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
