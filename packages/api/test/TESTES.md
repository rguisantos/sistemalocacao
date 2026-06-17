# Testes

## Integração (sem dependências externas) — roda já
Harness em memória que exercita os cenários offline→online (pull escopado, idempotência de lote,
allowlist protegendo senha, cobrança append-only, saldo derivado, conflito versionado, tombstone):

```bash
npm -w @app/api run test:integracao
```

## e2e (NestJS + Supertest + banco de teste)
Sobe Postgres/Redis efêmeros, aplica as migrations e roda as specs reais da API.

```bash
docker compose -f docker-compose.test.yml up -d

export DATABASE_URL="postgresql://teste:teste@localhost:5433/locacoes_teste?schema=public"
export REDIS_URL="redis://localhost:6380"
export JWT_SECRET="segredo-de-teste-com-pelo-menos-32-caracteres!!"

npm -w @app/api run prisma:generate
npx prisma migrate deploy --schema ../database/prisma/schema.prisma
npm -w @app/api run test:e2e
```

Cobertura das specs:
- `auth.e2e-spec.ts` — login, senha errada (mensagem genérica), logout global revogando token, rate limit.
- `cobrancas.e2e-spec.ts` — cálculo + saldo derivado, contador atualizado, trava de locação única, idempotência por UUID, finalização gerando saldo devedor.
- `sync.e2e-spec.ts` — pull escopado por rota sem senha, idempotência de lote, senha protegida no push, conflito versionado registrado.
