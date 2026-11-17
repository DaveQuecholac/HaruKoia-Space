# `@harukoia/host` — Contenedor host

Dueño de los datos y del commit de una sala. Corre en la máquina del developer (sala de usuario) o en un servidor (sala global), con la misma imagen.

Responsabilidades: sala Yjs en vivo, base local, copia de trabajo del repositorio, conversión a markdown con IA y exportación a PDF y Word.

### Almacenes en disco (separados)

| Archivo | Variable | Qué guarda |
|---------|----------|------------|
| `data/sala.sqlite` | `SALA_SQLITE` | Documento Yjs vivo (H3) |
| `data/replica.sqlite` | `REPLICA_SQLITE` | Grafo de commits + snapshots (H4 / V2). **No** mezclar con el Yjs |

La cola PowerSync hacia la réplica central entra en V6; V2 es solo local.

| Dato | Valor |
|------|-------|
| URL de desarrollo | `https://host.harukoia.local.iokoia.dev/` |
| Proceso PM2 | `harukoia-host-dev` |
| Logs | `logs/pm2/*.log` |

Abre la conexión **hacia** el orquestador, para funcionar detrás de NAT sin abrir puertos.

Diseño: [analisis-arquitectura-v2.md](../../docs/fijos/arquitectura/analisis-arquitectura-v2.md).
