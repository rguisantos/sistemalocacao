# Sistema de Locações e Cobranças

Gestão de locação de equipamentos (mesas de sinuca, jukebox) com cobrança em campo, **offline-first** no
mobile e sincronização bidirecional com o servidor. Monorepo TypeScript.

## Pacotes
| Pacote | O que é | Stack |
|---|---|---|
| `@app/core` | Núcleo compartilhado: cálculo de cobrança, sync (contrato/resolver), segurança | TS puro, testado |
| `@app/api` | API central | NestJS, Prisma, PostgreSQL, Redis |
| `@app/web` | Painel administrativo | Next.js 14, Tailwind, Recharts, Leaflet |
| `@app/mobile` | App do cobrador | Expo, SQLite, Leaflet |
| `packages/database` | Schema Prisma (fonte do banco) | Prisma |

## Documentos
- `ARQUITETURA.md` — decisões que regem tudo e a correspondência **auditoria → código**.
- `ROADMAP.md` — fases (0–7) e o que está pronto.
- `MIGRACAO.md` — plano de migração dos dados existentes.
- READMEs por pacote (`packages/*/README.md`).

## Decisões inegociáveis (resumo)
- Dinheiro em `Decimal(12,2)`, arredondamento HALF_UP (centralizado em `@app/core/money`).
- Saldo é **derivado** do histórico append-only — nunca confiado do cliente via sync.
- Sync: allowlist de campos (senha nunca trafega), tombstones, idempotência, relógio do servidor, conflito → servidor vence.
- JWT com revogação (`tokenVersao`), rate limiting persistente, webhook Mercado Pago validado por assinatura.

## Rodar (desenvolvimento)
```bash
npm install
# infra local
docker compose -f packages/api/docker-compose.test.yml up -d
# API
cp packages/api/.env.example packages/api/.env   # ajuste os segredos
npm -w @app/core run build
npm -w @app/api run prisma:migrate
npx ts-node packages/api/prisma-seed/seed.ts       # permissões + admin
npm -w @app/api run start:dev                      # Swagger em /docs
# Web
NEXT_PUBLIC_API_URL=http://localhost:3000 npm -w @app/web run dev
# Mobile
EXPO_PUBLIC_API_URL=http://SEU_IP:3000 npm -w @app/mobile run start
```

## Testes e verificação
```bash
npm -w @app/core test                       # cálculo, calendário, sync, saldo
node packages/api/test/integracao-harness.js # cenários offline→online (15/15)
node packages/mobile/src/sync/sync-harness.js# cliente de sync (7/7)
npm -w @app/api run test:e2e                 # e2e com Postgres+Redis (ver test/TESTES.md)
```
Partes de maior risco verificadas por harness ao longo do desenvolvimento: cálculo **21/21**,
calendário **14/14**, resolver de sync **9/9**, integração e2e **15/15**, cliente de sync mobile **7/7**,
integrações (cripto/webhook) **9/9**, recibo ESC/POS **7/7**.

## Deploy
- API: `packages/api/Dockerfile` + `docker-compose.yml` (Postgres + Redis + API, migrations no boot).
- CI: `.github/workflows/ci.yml` (lint/build/tests + harnesses; e2e com serviços; build mobile via EAS em `main`).
- Mobile: EAS Build (Android/iOS).
