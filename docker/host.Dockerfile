FROM node:24-alpine

WORKDIR /app

# git para comitear y clonar; pandoc para exportar a PDF y Word.
RUN apk add --no-cache git pandoc

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/host ./apps/host

RUN pnpm install --frozen-lockfile=false --filter @harukoia/host...

RUN pnpm --filter @harukoia/host run build

ENV NODE_ENV=production
ENV HOST_DATA_DIR=/data
WORKDIR /app/apps/host

CMD ["node", "dist/main.js"]
