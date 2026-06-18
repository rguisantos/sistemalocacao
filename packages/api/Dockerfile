# Build multi-stágio da API (contexto = raiz do monorepo).
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/database packages/database
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY packages/core packages/core
COPY packages/api packages/api
RUN npm -w @app/core run build \
 && npm -w @app/api run prisma:generate \
 && npm -w @app/api run build

FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
WORKDIR /app/packages/api
EXPOSE 3000
# aplica migrations e sobe
CMD ["sh", "-c", "npx prisma migrate deploy --schema ../database/prisma/schema.prisma && node dist/main.js"]
