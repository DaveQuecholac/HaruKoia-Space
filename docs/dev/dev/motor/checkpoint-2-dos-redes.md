# Checkpoint 2 — el túnel cruza entre dos redes

El plan lo coloca **después de B3 y antes de B4**: se prueba con scripts en los dos extremos, porque el host real todavía no existe.

> **Checkpoint 2.** El túnel cruza NAT. Si algo de la arquitectura iba a fallar, falla aquí. **No se sigue sin esta prueba hecha entre dos redes.**

## Qué prueba, y qué no

| Prueba | No prueba |
|--------|-----------|
| Que una máquina **sin puertos abiertos** queda alcanzable porque marca hacia fuera | Nada de pizarra: aquí no hay Yjs ni lienzo |
| Que los bytes cruzan **íntegros** en los dos sentidos | Nada de navegador: eso es el checkpoint 3, después de B6 |
| Que la conexión **aguanta abierta** y el TLS de en medio no la corta | Reconexión tras caídas: eso es B7 |

El tercer punto es el que más importa descubrir aquí. Un terminador de TLS que mata conexiones inactivas rompería H1 entero, y es mejor saberlo antes de construir cinco pasos encima.

## Requisitos del servidor

Son del código, no preferencias:

| Requisito | Por qué |
|-----------|---------|
| Node **23.6 o más** | Los paquetes de servidor ejecutan TypeScript directo, sin compilar |
| Nombre de dominio con **TLS real** | El navegador exigirá `wss://` desde una página `https://`. Se valida ya, aunque aquí no haya navegador |
| TLS que **pase el upgrade** y no corte conexiones inactivas | Es el fallo clásico de esta arquitectura |
| `80` y `443` abiertos | Para el certificado y para el tráfico |

El orquestador ya lee `HOST` y `PORT` del entorno, así que **no hace falta tocar código** para desplegarlo.

Con el contenedor, el requisito de Node lo cumple la imagen: en el servidor no hace falta instalar Node ni pnpm.

## Pasos

### 1. En el servidor

```bash
git clone <este repo> && cd motor-colaborativo && git checkout dev/motor

docker build --build-arg APP=orchestrator -t harukoia-orquestador .
docker run -d --name orquestador -p 8080:8080 --restart unless-stopped harukoia-orquestador
```

Con Podman es el mismo comando cambiando `docker` por `podman`.

Delante va un proxy que termine TLS hacia `127.0.0.1:8080` y **no toque el upgrade**. Comprobación:

```bash
curl https://<tu-dominio>/health     # {"service":"orchestrator","status":"ok"}
```

Sin contenedor, el camino directo también sirve y necesita Node 23.6 o más:

```bash
pnpm install && PORT=8080 HOST=0.0.0.0 node apps/orchestrator/src/main.ts
```

### 2. En tu máquina, detrás del NAT de casa

```bash
cd apps/orchestrator/src/tunel
node humo.mjs host wss://<tu-dominio>
```

Imprime el comando del invitado, ya armado con la sala y el token. **Cópialo.**

### 3. En la otra red

Pega el comando que imprimió el paso 2. Vale el propio servidor —está en una red distinta a tu casa— o la máquina de QA, que además valida una tercera red:

```bash
SEGUNDOS=120 node humo.mjs invitado wss://<tu-dominio> <sala> <token>
```

Tiene que ir por `wss://`, no por el puerto local del servidor: el punto es atravesar el TLS.

Si el TLS no es de una CA pública, añade `NODE_EXTRA_CA_CERTS=/ruta/ca.pem`.

## Cómo se lee el resultado

El invitado imprime el veredicto y sale con código `0` solo si todo pasó:

```
  ── Veredicto del checkpoint 2 ──

    ✓  el invitado entra sin conocer al host
    ✓  bloque de 512 KB cruza íntegro
    ✓  pulso 1 cruza íntegro
    ✓  la conexión aguanta 120 s sin cortes

  ✓ El túnel cruza entre las dos redes.
```

Los rechazos salen **con causa**, nunca en silencio: `token-de-invitacion-invalido`, `sala-no-encontrada`, `ticket-invalido`.

La sesión completa se sigue desde los registros del orquestador con el identificador de la sala:

```bash
grep "sala=<id>" <log del orquestador>
```

## Si falla

| Síntoma | Qué significa |
|---------|---------------|
| `404` al conectar | La URL no llega al orquestador: revisa el proxy |
| El invitado entra pero no vuelve ningún byte | El proxy rompe el upgrade de la conexión de datos |
| Aguanta unos minutos y se cierra solo | El TLS corta conexiones inactivas. **Es el hallazgo que este checkpoint busca** y hay que resolverlo antes de B4 |
| `sala-no-encontrada` con el token bien | El registro del host caducó por falta de latido, o el orquestador se reinició |

## Evidencia

Al pasarlo, pegar aquí la salida del veredicto con la fecha, y marcar el checkpoint como hecho en el [README de la rama](README.md).

**Estado: pendiente.** Lo verificado hasta ahora es local, incluido el paso por el proxy de desarrollo.
