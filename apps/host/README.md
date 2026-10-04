# `@harukoia/host` — Contenedor host

Dueño de los datos y del commit de una sala. Corre en la máquina del developer (sala de usuario) o en un servidor (sala global), con la misma imagen.

Responsabilidades: sala Yjs en vivo, base local, copia de trabajo del repositorio, conversión a markdown con IA y exportación a PDF y Word.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://host.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-host-dev` |
| Logs | `logs/pm2/*.log` |

Abre la conexión **hacia** el orquestador, para funcionar detrás de NAT sin abrir puertos.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
