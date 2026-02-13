FROM node:25-bookworm-slim

WORKDIR /app

RUN npm install --global corepack@latest --force && \
    corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/agent/package.json ./apps/agent/

RUN pnpm install --filter agent

COPY apps/agent ./apps/agent

RUN pnpm --filter agent run build

WORKDIR /app/apps/agent

RUN npx playwright install --with-deps chromium

CMD ["node", "dist/index.js"]