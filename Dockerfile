# syntax=docker/dockerfile:1

# Empaqueta **un** proceso de Node de este monorepo. Cuál, lo decide `APP`:
#
#   podman build --build-arg APP=orchestrator -t harukoia-orquestador .
#   podman build --build-arg APP=host         -t harukoia-host .
#
# Está en la raíz y parametrizado a propósito: la arquitectura pide un
# contenedor host **genérico**, así que añadir una variante no debe costar un
# archivo nuevo.
#
# No hay etapa de construcción porque no hay nada que construir: Node ejecuta
# el TypeScript quitándole los tipos. Por eso la versión de Node es un
# requisito real y no una preferencia.

# 23.6 es el mínimo en el que Node quita tipos sin bandera. Se fija 24 porque es
# lo que corre en las máquinas del equipo.
FROM node:24-slim

ARG APP
ENV APP=${APP}

WORKDIR /motor

# Copiar todo y después instalar: sin paso de construcción, partirlo en capas
# para aprovechar la caché no compra nada y sí esconde errores.
COPY . .

# corepack toma la versión de pnpm del campo `packageManager` de la raíz, así
# que aquí no se repite el número.
#
# `pnpm install` deja los paquetes internos como enlaces hacia
# `/motor/packages/*`, fuera de `node_modules`. Esa es la condición para que
# Node les quite los tipos: dentro de `node_modules` no lo hace. Por eso aquí
# **no** se usa `pnpm deploy`, que los copiaría adentro y rompería el arranque.
RUN corepack enable && pnpm install --frozen-lockfile --prod

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

USER node

# Forma de shell para que `${APP}` se expanda.
CMD node apps/${APP}/src/main.ts
