# Deploy e Homologação

## Migrations versionadas (spec §15)
Em desenvolvimento usamos `prisma db push` (rápido, sem histórico). Antes da
homologação, **gere a migration inicial versionada** — os Dockerfiles aplicam
`prisma migrate deploy` na subida:

```bash
# uma vez, com o banco de dev no ar:
npx prisma migrate dev --name init --schema packages/database/prisma/schema.prisma
# commit da pasta packages/database/prisma/migrations/
```

A partir daí, toda mudança de schema = nova migration (`migrate dev --name ...`).

## Homologação (tudo em Docker)
```bash
cp .env.example .env.homolog        # defina JWT_*_SECRET (≥32 chars)
docker compose -f docker-compose.homolog.yml --env-file .env.homolog up -d --build
# seeds (admin + demo):
docker compose -f docker-compose.homolog.yml exec api npx tsx packages/database/prisma/seed.ts
docker compose -f docker-compose.homolog.yml exec api npx tsx packages/database/prisma/seed-demo.ts
```
Painel: http://localhost:3000 · Swagger: http://localhost:3001/api/docs

Para o **app mobile** apontar para a homologação, configure `EXPO_PUBLIC_API_URL`
com o IP da máquina (ex.: `http://192.168.0.10:3001`).

## Produção (sugestão)
- **API**: imagem `apps/api/Dockerfile` em qualquer host Docker (Fly.io, Railway,
  Render, VPS). Obrigatórios: `DATABASE_URL` (Postgres gerenciado), `REDIS_URL`
  (rate limit + bloqueio lógico compartilhados entre instâncias), `JWT_*_SECRET`.
  Mercado Pago: configure pelo painel (Integrações) ou via env.
- **Web**: Vercel (zero config, monorepo: root `apps/web`, defina
  `NEXT_PUBLIC_API_URL`) ou a imagem `apps/web/Dockerfile`.
- **Webhook MP**: aponte para `https://SEU_DOMINIO/api/pagamentos/webhook`
  e cadastre o secret correspondente.
- **Mobile**: builds via EAS (`eas build`); impressão térmica exige
  `expo prebuild` + lib nativa (ver tela Impressora).

## Checklist pré-produção
- [ ] Trocar a senha do admin do seed
- [ ] `JWT_*_SECRET` fortes e exclusivos por ambiente
- [ ] Redis presente (rate limit em memória reseta por instância)
- [ ] Backup automático do Postgres
- [ ] HTTPS na API (webhook MP exige)
