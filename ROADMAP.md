# Roadmap de construção

O núcleo (Fase 0) está pronto e testado. As fases seguintes constroem sobre ele com baixo risco, porque toda a correção financeira e as regras de sync/segurança já estão resolvidas e cobertas por teste.

## ✅ Fase 0 — Núcleo (entregue)
- `schema.prisma` completo com todas as correções da auditoria.
- `@app/core`: motor de cálculo (3 modos), saldo derivado, datas/fuso, contrato e resolver de sync, JWT com revogação, rate limiting.
- Testes do motor de cálculo (casos A–G + contador + saldo derivado).

## Fase 1 — API base
- ✅ Projeto NestJS + Prisma; validação de ambiente no boot.
- ✅ Auth: login (argon2id), refresh, logout global; revogação por `tokenVersao`.
- ✅ Guards globais: rate limit persistente (RedisStore), JWT+revogação, permissões no servidor.
- ✅ Auditoria com sanitização de dados sensíveis.
- ✅ CRUD de referência (`clientes`) com anti-IDOR por rota, concorrência otimista e soft-delete.
- ✅ Catálogo de permissões + papéis-preset.
- ✅ Demais CRUDs (usuários/permissões + papéis, produtos + alterar-contador + em-depósito, rotas, depósitos, auxiliares, endereços, transferência de rota).
- ✅ Base genérica `CadastroCrudService` + seed inicial (permissões + admin).
- ✅ Swagger.

## Fase 2 — Domínio de cobrança (servidor) ✅
- ✅ Serviço de cobrança usando `@app/core` (cálculo + snapshot reproduzível + idempotência por UUID).
- ✅ Pagamento append-only; saldo derivado do histórico (`SaldoService`).
- ✅ Finalização de locação (depósito/relocação) com criação de `SaldoDevedorLocacao` e trava de uma ativa por produto.
- ✅ Relocação detalhada (encerrar + abrir nova locação do mesmo produto + transportar pendência).
- ✅ Aba de saldo devedor (pagamento direto no `SaldoDevedorLocacao`, some ao quitar).

## Fase 3 — Sincronização ✅
- ✅ Endpoints `/sync/pull` e `/sync/push` usando `contrato.ts` + `resolver.ts` (tombstones, idempotência por lote, relógio do servidor, escopo por rota).
- ✅ Allowlist de campos (senha nunca trafega); append-only para cobrança/pagamento; versionado para o resto.
- ✅ Registro de conflitos em `ConflitoSincronizacao`; saldo recalculado do histórico recebido.
- ✅ Testes de integração: harness em memória (15 verificações, roda sem infra) + suíte e2e NestJS+Supertest (auth, cobranças, sync) com docker-compose de teste.

> Atualização: criação em campo de cliente (com endereço/GPS), produto e locação implementada no app
> (offline-first, grava como `created` e sincroniza no push).

## Fase 4 — Mobile (offline-first) — núcleo entregue
- ✅ SQLite local espelhando as entidades sincronizáveis (+ `_syncStatus`, `_lastModified`).
- ✅ Cliente de sync (pull com tombstones + relógio do servidor; push idempotente; conflito → servidor vence) — validado por harness (7/7).
- ✅ Login com fallback offline (hash local) + refresh de token.
- ✅ Cálculo de cobrança on-device reusando `@app/core`; registro offline (`created`).
- ✅ Telas Login → Rotas → Clientes → Cliente (abas) → Registrar cobrança + botão Sincronizar.
- ✅ Mapa **Leaflet** (WebView) + GPS (`expo-location`).
- ✅ Recibo (HTML/PDF + ESC/POS 58/60mm, validado por harness 7/7), impressão térmica Bluetooth, background sync (30 min), tela de manutenções.
- ⬜ Cadastro de cliente com mapa e PIX Mercado Pago (online) na tela de cobrança.

## Fase 5 — Web admin — fundação entregue
- ✅ Next.js 14 (App Router) + Tailwind (tokens próprios) + Recharts + Leaflet.
- ✅ Auth + sessão + autorização por permissão na UI; shell com navegação; rotas protegidas.
- ✅ Dashboard (indicadores + faturamento por rota) com estado vazio honesto.
- ✅ CRUD de referência (clientes) + produtos (+ em depósito) + mapa Leaflet (react-leaflet, SSR-safe).
- ✅ CRUDs de usuários (rotas + permissões por módulo + papéis-preset), rotas, depósitos e auxiliares (componente `CrudSimples` genérico + sub-navegação).
- ✅ Registro de cobrança no painel com pré-visualização ao vivo reusando o `@app/core` (mesma matemática do servidor).
- ✅ Criação/finalização de locações no painel.
- ✅ Relatórios no painel ligados ao backend (faturamento por rota + inadimplência) com exportação PDF/Excel.
- ✅ Endereço **cadastrado dentro do cliente** (embutido na criação, transacional; gerenciado na edição) com picker de coordenadas (Leaflet editável).
- ✅ Logs de auditoria (filtro + paginação) e configurações (Mercado Pago + tolerância) no painel. **Painel 100%.**

## Fase 6 — Integrações e relatórios — entregue
- ✅ Mercado Pago: criação de PIX + **webhook validado por assinatura HMAC** + idempotência por `pixId` + recálculo de saldo; credenciais criptografadas at-rest. Validado por harness (9/9).
- ✅ Relatórios: dashboard (consumido pelo painel), faturamento por rota, inadimplência + exportação PDF/Excel (padrão reutilizável).
- ✅ Notificações push (Expo) com job de inadimplência idempotente reusando os helpers de vencimento do `@app/core`.
- ⬜ Demais relatórios pré-definidos (11 restantes) + relatório flexível — mesmo padrão de query + exportação.

## Fase 7 — Operação
- CI/CD (lint, testes, deploy; EAS para mobile), versionamento de API (`/v1`).
- Observabilidade (logs estruturados, alertas de sync/webhook), backup/restore do Postgres.
- **Plano de migração** dos dados dos sistemas atuais.

---

### Sugestão de próximo passo
As 3 decisões de negócio foram fechadas e codificadas (mês-calendário, confirmação de período extra, atraso percentual por X dias). Próximo passo: **Fase 1 (API NestJS + Auth + CRUD)**, onde o `@app/core` passa a ser exercitado de ponta a ponta.
