# `@harukoia/orchestrator` — Orquestador

Proceso en la nube. Registra salas, genera links de invitación y hace de **relay** entre los invitados y el contenedor host, enrutando por identificador de sala.

**No guarda el tablero.** Si se reinicia, los hosts se vuelven a registrar y los invitados reconectan.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://orquestador.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-orchestrator-dev` |
| Logs | `logs/pm2/*.log` |

Arranque: `pnpm dev` desde aquí, o `pnpm dev` en la raíz para las tres apps. Ver `.cursor/rules/pm2-dev.mdc`.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
