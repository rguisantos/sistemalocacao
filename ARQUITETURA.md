# Arquitetura — Sistema de Locações e Cobranças

Documento de decisões que rege toda a implementação. Cada decisão resolve um ponto da auditoria e está **codificada** nos arquivos indicados.

## Stack final

| Camada | Tecnologia | Observação |
|---|---|---|
| API | Node 20+ / TypeScript / NestJS / Prisma | PostgreSQL 15+ |
| Web | Next.js 14+ (App Router) / shadcn/ui / Tailwind / Recharts | Leaflet para mapas |
| Mobile | React Native / Expo (Dev Client) / **SQLite direto** | offline-first |
| Geolocalização | **Leaflet + GPS do dispositivo** | sem dependência do Google Maps |
| Compartilhado | `@app/core` | regras de cálculo, sync e segurança — fonte única da verdade |

Decisões confirmadas com você: **SQLite direto** no mobile (não WatermelonDB) e **Leaflet** para mapa/GPS.

## Convenções inegociáveis

**Dinheiro.** Todo valor é `Decimal` (Prisma `@db.Decimal(12,2)`, `decimal.js` no código). Nunca `Float`/`parseInt`. Arredondamento **2 casas, HALF_UP**, aplicado em cada valor persistido/exibido. → `packages/core/src/money.ts`.

**Saldo (sinal).** `saldoDevedorAtual` = "quanto falta liquidar nesta locação". A direção (quem deve a quem) vem da `regra`, não do sinal. Aritmética uniforme nos três modos. Negativo = haver. → `calculo.ts` (cabeçalho).

**Tempo.** Cálculo de dias/períodos usa fuso fixo (`America/Sao_Paulo`), contando datas de calendário. → `datas.ts`.

**Saldo é derivado, nunca sincronizado.** Pagamentos e cobranças são **append-only**; o servidor recalcula o saldo a partir deles. Isso elimina a perda de pagamentos sob *last-write-wins*. → `calculo.ts: recalcularSaldoLocacao`, `sync/resolver.ts`.

## Como cada ponto da auditoria foi resolvido

### P0
- **Saldo sob LWW perdia pagamento** → modelo append-only (`Pagamento`) + saldo derivado. `schema.prisma` (model Pagamento), `sync/resolver.ts` (APPEND_ONLY).
- **Soft-delete / exclusões vazando** → `deletedAt` em toda entidade sincronizável; pull envia **tombstones**. `schema.prisma`, `sync/contrato.ts`.
- **Campos sensíveis no sync (senha)** → allowlist por entidade + `CAMPOS_PROIBIDOS`. `senha`/`tokenVersao` nunca trafegam. `sync/contrato.ts: sanitizarPush`.
- **JWT sem revogação / secret hardcoded** → secret obrigatório via env; revogação por `tokenVersao`. `seguranca/jwt.ts`, `schema.prisma` (Usuario.tokenVersao).
- **Rate limiting ausente** → limitador persistente (Redis/KV). `seguranca/rate-limit.ts`.
- **Webhook Mercado Pago sem validação** → exigir assinatura + idempotência + reconciliação por polling (a implementar na API; contrato já prevê `pixId` e Pagamento idempotente).
- **Arredondamento indefinido** → política única em `money.ts` (validada em testes).
- **Idempotência de cobrança** → UUID gerado no cliente + upsert por id; cobrança é append-only. `sync/resolver.ts`.

### P1
- **Entidade Pagamento ausente** → criada. `schema.prisma`.
- **Locação única por produto** → coluna única nula `chaveProdutoAtivo`. `schema.prisma`.
- **Índices de performance** → em todas as FKs e `updatedAt`. `schema.prisma`.
- **Fuso no cálculo** → `datas.ts`.
- **Acúmulo de período** → resolvido: mês-calendário + confirmação de período extra (`periodosDecorridos`, `requerConfirmacaoPeriodoExtra`), nada dobra silenciosamente.
- **Convenção de sinal** → documentada e uniforme.
- **PIX MP offline** → contrato distingue online (MP) de offline (PIX_MANUAL).
- **Edição de regra retroativa** → `regraVersao` na locação + `regraSnapshot`/`regraVersaoSnapshot` na cobrança.

### P2
- **`conflitos_sincronizacao` não modelada** → `ConflitoSincronizacao`.
- **Contador rollover/troca** → flag `contadorReiniciado` + tratamento em `calculo.ts`.
- **Auditoria com dado sensível** → `LogAuditoria` nunca grava `senha`/token (regra de aplicação).
- **Papéis como preset de permissões** → a definir na API (seeds de papéis).

## Decisões de negócio — confirmadas

1. **Período mensal = mês-calendário** (não 30 dias fixos). Cobrou 15/jan → próximo período em 15/fev; fim de mês faz clamp (31/jan → 28/fev).
2. **Acúmulo de período com confirmação.** O valor base é o período atual; cada período completo cruzado faz `periodos` subir e a UI exibe "já há outro período, deseja atualizar o valor?" (`requerConfirmacaoPeriodoExtra`). Nada dobra silenciosamente. Modelo generalizado para todas as frequências: `periodos = 1 + períodos completos decorridos`.
3. **Atraso na modalidade percentual = X dias após a última cobrança** (X configurável por sistema/locação). Para valor fixo, atraso = cruzou a data do próximo período. → `datas.ts: vencidaPercentual / vencidaValorFixo`.

Implementado em `datas.ts` (`periodosDecorridos`, `proximaDataPeriodo`, `adicionarMeses`, `vencida*`) e exposto por `calcularValorFixo`. Validado em teste.
