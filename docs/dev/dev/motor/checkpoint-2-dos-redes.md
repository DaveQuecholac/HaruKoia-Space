# Checkpoint 2 — el túnel cruza entre dos redes

El plan lo coloca **después de B3 y antes de B4**: se prueba con scripts, no con el navegador.

> **Checkpoint 2.** El túnel cruza NAT. Si algo de la arquitectura iba a fallar, falla aquí. **No se sigue sin esta prueba hecha entre dos redes.**

## Cómo funciona (en una frase)

Coolify en **Makino Hara** deja el orquestador en una URL pública con HTTPS. Tu laptop (atrás del NAT) abre una conexión **saliente** hacia esa URL. El “invitado” corre en otra red (el propio servidor o QA) y también marca hacia esa URL. El orquestador pega las dos puntas. **Nadie abre puertos en tu casa.**

## Qué no es este checkpoint

| No | Por qué |
|----|---------|
| Abrir la web HaruKoia en el navegador | Todavía no hay pantallas de sala (eso es B6) |
| “Unirme a una sala” desde la UI | Checkpoint 3, después de B6 |
| Pizarra / Yjs | Fuera de H1 |

Aquí solo demuestras: **túnel + TLS + dos redes**.

## Subir con Coolify (Makino Hara)

Repo ya en `origin/dev/motor`. En Coolify:

1. Nueva aplicación en el servidor **Makino Hara**.
2. Fuente: este repo, rama **`dev/motor`**.
3. Build pack: **Docker Compose** (usa `docker-compose.yml` de la raíz)  
   — o **Dockerfile** con Build Arg `APP=orchestrator`.
4. **Ports Exposes / puerto interno: `8080`.**
5. Dominio público con HTTPS (el que Coolify te asigne o el tuyo).
6. Deploy.

Comprobación mínima (esto **sí** se ve en el navegador o con curl):

```bash
curl https://<TU-DOMINIO-DEL-ORQUESTADOR>/health
# debe responder exactamente:
# {"service":"orchestrator","status":"ok"}
```

Si eso falla, **no sigas**. Arregla Coolify / dominio / puerto.

Variables (si Coolify las pide a mano):

| Variable | Valor |
|----------|-------|
| `HOST` | `0.0.0.0` |
| `PORT` | `8080` |
| Build Arg `APP` | `orchestrator` (solo si usas Dockerfile puro) |

## Prueba del túnel (esto es el checkpoint)

Necesitas Node en **tu PC** (para correr el arnés). El servidor ya tiene el contenedor.

### A — En tu laptop (red de casa)

```bash
git clone <repo> && cd motor-colaborativo && git checkout dev/motor
pnpm install
cd apps/orchestrator/src/tunel
node humo.mjs host wss://<TU-DOMINIO-DEL-ORQUESTADOR>
```

Copia el comando que imprime (lleva sala + token).

### B — En la otra red

Opciones válidas:

- SSH al servidor Makino Hara y corre el comando ahí, **o**
- la máquina de QA en otra red.

```bash
# dentro del repo, misma carpeta del arnés:
SEGUNDOS=120 node humo.mjs invitado wss://<TU-DOMINIO> <sala> <token>
```

Tiene que ser **`wss://`** del dominio público, no `ws://localhost`.

### Qué debes ver (veredicto bueno)

```
  ── Veredicto del checkpoint 2 ──

    ✓  el invitado entra sin conocer al host
    ✓  bloque de 512 KB cruza íntegro
    ✓  pulso … cruza íntegro
    ✓  la conexión aguanta 120 s sin cortes

  ✓ El túnel cruza entre las dos redes.
```

Código de salida del invitado: **`0`**.

## Lista de verificación (si todo esto pasa, está bien)

| # | Prueba | Resultado esperado |
|---|--------|--------------------|
| 1 | Coolify Deploy verde | Contenedor up |
| 2 | `https://<dominio>/health` | `{"service":"orchestrator","status":"ok"}` |
| 3 | Abrir `https://<dominio>/` en el navegador | JSON `not found` — **normal**, no hay página |
| 4 | Modo host en tu laptop | Imprime el comando del invitado |
| 5 | Modo invitado en otra red | Veredicto con todos los ✓ y exit 0 |
| 6 | Aguanta ~2 minutos | No se cierra solo (si se cierra: Coolify/proxy corta idle) |

Cuando **1–6** pasen → checkpoint 2 cerrado → se puede seguir con **B4**.

## Si falla

| Síntoma | Qué significa |
|---------|---------------|
| `/health` no responde | Dominio, puerto 8080 o build arg mal en Coolify |
| Host no conecta por `wss://` | TLS / DNS / proxy de Coolify |
| Entra pero no vuelven bytes | El proxy no pasa WebSocket upgrade |
| Se corta a los N minutos | Idle timeout del proxy — hay que subir el timeout antes de B4 |

## Evidencia

**Estado: pasado el 2026-10-04.**

- Orquestador: Coolify en Makino Hara, `wss://orquestador.harukoia.makinohara.sys.iokoia.com`.
- Host: el arnés en modo host, en la laptop detrás del NAT de casa.
- Invitado: el arnés en modo invitado, desde otra red. Veredicto con todos los ✓.

Lado del host, segunda sala de la sesión:

```
15:52:56.254  sala registrada: crnadztb6g6er9hn
15:54:24.955  avisan de un invitado (1a0b3zp7cdz845p4) por el canal sesion
15:54:25.343  conexión de datos saliente abierta
15:54:26.369  emparejado: desde aquí solo pasan bytes
15:55:25.555  el invitado 1a0b3zp7cdz845p4 se fue
15:55:25.658  conexión de datos cerrada (código 1000)
15:59:06.647  avisan de un invitado (9wtrc1a8nwkk7qsn) por el canal sesion
15:59:08.172  emparejado: desde aquí solo pasan bytes
16:00:07.259  el invitado 9wtrc1a8nwkk7qsn se fue
16:00:07.357  conexión de datos cerrada (código 1000)
```

Pendiente para cerrar H1, no para seguir: repetir con `SEGUNDOS=120` o más para descartar que el proxy de Coolify corte conexiones inactivas largas.

**Desde B4** el arnés exige el aviso `emparejamiento-aceptado`. Para repetir esta prueba hay que redesplegar el orquestador en Coolify.
