FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/orchestrator ./apps/orchestrator

RUN pnpm install --frozen-lockfile=false --filter @harukoia/orchestrator...

RUN pnpm --filter @harukoia/orchestrator run build

ENV NODE_ENV=production
WORKDIR /app/apps/orchestrator

CMD ["node", "dist/main.js"]
