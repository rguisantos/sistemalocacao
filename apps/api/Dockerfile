# API — build de homologação/produção (monorepo npm workspaces)
# docker build -f apps/api/Dockerfile -t locacoes-api .
FROM node:20-alpine AS base
WORKDIR /app

# Instala dependências do workspace inteiro (camada cacheável)
COPY package.json package-lock.json* turbo.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN if [ -f package-lock.json ]; then npm ci --omit=optional; else npm install --omit=optional; fi

# Código + Prisma Client
COPY packages ./packages
COPY apps/api ./apps/api
RUN npx prisma generate --schema packages/database/prisma/schema.prisma

ENV NODE_ENV=production
EXPOSE 3001

# Aplica migrations versionadas e sobe (tsx: pacotes do workspace em TS)
CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/database/prisma/schema.prisma && npx tsx apps/api/src/index.ts"]
