# Handoff para o agente de testes

Monorepo npm workspaces (`packages/*`): `@app/core` (lógica pura, testada), `@app/api` (NestJS),
`@app/web` (Next.js 14), `@app/mobile` (Expo SDK 50), `database` (Prisma/Postgres, fonte do schema).

## Pré-requisitos
- **Node 20 LTS** (não há `.nvmrc`; Nest/Next 14/Expo 50 exigem Node ≥18, recomende 20).
- **Docker** (para os testes e2e: Postgres + Redis).
- **Não há `package-lock.json` versionado** → use **`npm install`** na raiz (o `npm ci` do CI vai falhar até
  existir um lockfile; gere e versione um, ou troque o CI para `npm install`).

## Ordem de build
`@app/core` é dependência das outras camadas e precisa ser compilado primeiro.
```bash
npm install                       # na raiz (gera node_modules dos workspaces)
npm -w @app/core run build        # tsc do núcleo
npm -w @app/api run prisma:generate
```

## Verificações estáticas (NÃO foram executadas neste ambiente — rodar)
Foram validadas aqui apenas por scans estáticos (imports/navegação/SQL) e harnesses de lógica; **`tsc`,
ESLint e e2e nunca rodaram** (sem instalação/rede). Prioridade do agente:
```bash
npm -w @app/core run build        # tsc -p (typecheck do núcleo)
npm -w @app/api run build         # nest build (typecheck da API)
npm -w @app/web  run build        # next build (typecheck do web)
npm -w @app/core run lint         # eslint
npm -w @app/web  run lint         # next lint
# Mobile não tem script de typecheck; rode:  npx tsc --noEmit -p packages/mobile/tsconfig.json
```
Observação: há uso intencional de `any` em props de `route`/`navigation` no mobile — esperado, não é erro.

## Testes sem infraestrutura (rodam já)
```bash
npm -w @app/core test                                   # jest do núcleo (cálculo/calendário/sync/saldo)
node packages/api/test/integracao-harness.js            # 15/15 esperado
node packages/mobile/src/sync/sync-harness.js           # 7/7 esperado
node packages/api/test/finalizacao-harness.js           # 7/7 esperado (finalização/re-locação offline)
```

## Testes e2e da API (Postgres + Redis)
```bash
docker compose -f docker-compose.test.yml up -d
export DATABASE_URL="postgresql://teste:teste@localhost:5433/locacoes_teste?schema=public"
export REDIS_URL="redis://localhost:6380"
export JWT_SECRET="segredo-de-teste-com-pelo-menos-32-caracteres!!"
export CONFIG_SECRET="outro-segredo-de-teste-com-32-ou-mais-caracteres"
npm -w @app/core run build
npx -w @app/api prisma db push --schema ../database/prisma/schema.prisma   # não há migrations: empurra o schema
npm -w @app/api run test:e2e          # specs: auth, cobrancas, sync
docker compose -f docker-compose.test.yml down -v
```
Variáveis completas em `packages/api/.env.example`.

## Áreas de foco (mudanças recentes — ver REVISAO.md, rodadas 11–16)
1. **Finalização → re-locação offline do mesmo produto** (o fluxo mais novo/sensível):
   - Servidor (`packages/api/src/sync/sync.service.ts`): deriva `chaveProdutoAtivo` do status, aplica
     finalizações antes de ativações no lote, inicializa `valorRestante` de saldos novos.
   - Mobile (`finalizarLocacao` em `repositorios.ts` + `FinalizarLocacaoScreen`).
   - Lógica coberta por `finalizacao-harness.js`; **falta spec e2e** (ver lacunas).
2. **Sync push/pull**: simetria, allowlist (`@app/core/sync/contrato.ts`), pull envia campos derivados.
3. **Quitação de saldo** (pagamento append-only; recálculo do restante).
4. **Lista de cobrança** (`clientesParaCobrar`): só saldos `> 0`, agrupamento por rota, atraso configurável.
5. **Proteção contra duplo-toque** nas telas que inserem (cobrança/pagamento/cadastro/finalização).
6. **Corrida de boot do SQLite** corrigida (`obterDb` memoriza a promessa) — testar concorrência no boot.
7. **Refresh de token no 401** no web (`packages/web/src/lib/api.ts`).
8. **Índices SQLite** novos (`packages/mobile/src/db/schema.ts`).

## Lacunas conhecidas / o que adicionar
- **Sem specs e2e para os fluxos novos** (finalização→relocação, quitação, lista de cobrança). Existem apenas
  `auth`, `cobrancas`, `sync`. Recomendado adicionar e2e cobrindo: finalizar locação com saldo → criar nova
  locação do mesmo produto → sincronizar (verificar `chaveProdutoAtivo`/unicidade e o `SaldoDevedorLocacao`).
- **Mobile sem teste de UI/instrumentado** — só harness de lógica de sync. Considerar testes de componente.
- **Mapa (WebView Leaflet) dentro de ScrollView**: o gesto de arrastar o mapa pode competir com o scroll em
  alguns aparelhos — verificar manualmente em device.
- **Total da lista de cobrança** usa soma em float (guia de campo); valores exatos por item usam Decimal.
- **Sem migrations Prisma versionadas**: o schema é aplicado via `prisma db push` (dev/teste). Para produção,
  gerar migrations reais (`prisma migrate dev`) e versioná-las.

## O que já foi verificado aqui (por harness/scan, sem rodar tsc/e2e)
Núcleo (jest), integração 15/15, sync mobile 7/7, finalização 7/7, alinhamento SQL placeholder×parâmetro,
imports/navegação consistentes, diff colunas-mobile×allowlist-servidor sem perda de dados.
