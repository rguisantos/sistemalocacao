# Painel web — build de homologação/produção
# docker build -f apps/web/Dockerfile -t locacoes-web .
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* turbo.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=optional

COPY packages ./packages
COPY apps/web ./apps/web
# NEXT_PUBLIC_API_URL é embutida no bundle em build-time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx prisma generate --schema packages/database/prisma/schema.prisma \
  && npm run build -w web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
