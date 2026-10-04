# syntax=docker/dockerfile:1

# Empaqueta **un** proceso de Node de este monorepo. Cuál, lo decide `APP`.
#
# Pensado para **Docker + Coolify** (servidor Makino Hara):
#
#   - Build pack: Dockerfile
#   - Build Arg: APP=orchestrator
#   - Ports Exposes: 8080
#   - Dominio con HTTPS (Coolify termina el TLS)
#   - Healthcheck: GET /health  (también va en la imagen)
#
# Añadir otra variante no cuesta un archivo nuevo:
#
#   docker build --build-arg APP=orchestrator -t harukoia-orquestador .
#   docker build --build-arg APP=host         -t harukoia-host .
#
# No hay etapa de construcción: Node ejecuta el TypeScript quitándole los
# tipos. Por eso Node ≥ 23.6 es un requisito real. Se fija 24.

FROM node:24-slim

# Por defecto el orquestador: es lo que Coolify despliega en el checkpoint 2.
# Si Coolify no inyecta el build arg, la imagen igual arranca bien.
ARG APP=orchestrator
ENV APP=${APP}

WORKDIR /motor

# curl: Coolify (y el HEALTHCHECK de la imagen) lo usan para /health.
# Sin esto, el healthcheck falla y el proxy ve el contenedor como caído.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY . .

# corepack toma la versión de pnpm del campo `packageManager` de la raíz.
#
# `pnpm install` deja los paquetes internos como enlaces hacia
# `/motor/packages/*`, fuera de `node_modules`. Esa es la condición para que
# Node les quite los tipos. **No** usar `pnpm deploy`: los copiaría adentro
# y el proceso fallaría al arrancar.
RUN corepack enable && pnpm install --frozen-lockfile --prod

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail "http://127.0.0.1:${PORT}/health" || exit 1

USER node

# Forma de shell para que `${APP}` se expanda.
CMD node apps/${APP}/src/main.ts
