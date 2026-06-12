# Sistema de Locações e Cobranças

Sistema fullstack para gestão de locação de equipamentos operados por ficha/moeda (mesas de sinuca, jukebox, fliperamas): locações com três regras de cobrança, cobrança em campo **offline-first** com cálculo automático, saldo devedor/haver por locação, finalização para depósito ou relocação, sincronização bidirecional com resolução de conflitos, PIX Mercado Pago, painel web administrativo e app mobile Expo.

---

## 1. Stack

| Camada | Tecnologia | Observação vs. spec original |
|---|---|---|
| Monorepo | Turborepo + npm workspaces | Adição: types e engine de cálculo compartilhados |
| Mobile | Expo SDK 52 / React Native + expo-router | Conforme spec |
| Banco local | **expo-sqlite** (SQLite síncrono) | Spec sugeria WatermelonDB; optou-se por SQLite direto com o mesmo modelo (`sync_status`, `version`, `base_version`) — menos dependências, controle total das queries |
| Web | **Next.js 15** (React 19) + Tailwind + TanStack Query + Zustand | Spec dizia "React"; Next dá roteamento, build e deploy Vercel prontos |
| Backend | Node.js + **Express** + TypeScript | Escolha entre Express/NestJS do spec |
| Banco servidor | PostgreSQL 16 | Conforme |
| ORM | **Prisma** | Conforme |
| Auth | JWT (CPF + senha) + refresh tokens opacos revogáveis | Reforçado além do spec |
| Pagamentos | Mercado Pago PIX + webhook HMAC | Conforme |
| Impressão | ESC/POS Bluetooth (lib nativa opcional) + PDF (expo-print) | Conforme |
| Rate limit | Redis (`rate-limiter-flexible`) com fallback memória | Adição |
| Infra dev | docker-compose (Postgres + Redis) | Adição |
| CI | GitHub Actions (type-check + testes com Postgres de serviço) | Adição |

**Identificadores:** servidor gera `cuid`; registros criados no mobile usam UUID v4 — ambos convivem (PKs são `String`).
**Dinheiro:** `Decimal(10,2)` no Postgres, `decimal.js` no código, strings decimais no tráfego e `TEXT` no SQLite. **Nunca float.**

---

## 2. Arquitetura do monorepo

```
locacoes-sistema/
├── packages/
│   ├── database/          # Prisma schema, seed base, seed de demonstração
│   └── shared/            # ⭐ ENGINE DE CÁLCULO + types + Zod + permissões
├── apps/
│   ├── api/               # Express: auth, CRUDs, sync, conflitos, PIX, relatórios (+ testes)
│   ├── web/               # Next.js: painel administrativo completo
│   └── mobile/            # Expo: app do cobrador, offline-first
├── docs/AUDITORIA-INTERNA.md   # findings de segurança/engenharia e correções
├── docker-compose.yml
└── .github/workflows/ci.yml
```

**Princípio central:** o engine de cálculo (`packages/shared/src/utils/calculo.ts`) é usado pelo servidor **e** pelo mobile — o cálculo offline é matematicamente idêntico ao online. O servidor sempre **recalcula** cobranças vindas do sync.

---

## 3. Modelagem de dados (Prisma → PostgreSQL)

| Entidade | Destaques |
|---|---|
| `Usuario` | CPF único, `senhaHash` (bcrypt 12), N:N com `Permissao` e `Rota` |
| `RefreshToken` | Hash SHA-256 persistido → revogável; rotação a cada uso |
| `Permissao` | 27 chaves em 5 grupos (seed) |
| `Rota` / `UsuarioRota` | Cobradores restritos às suas rotas |
| `Cliente` / `Endereco` | PF/PJ, telefones JSON, 1:N endereços com lat/long opcionais |
| `Produto` + auxiliares | Plaqueta única, `TipoProduto`/`Tamanho`/`Condicao`, contador |
| `Deposito` | Destino de finalização |
| `Locacao` | Regra + frequência/valores, `contadorInicial`, `saldoAtual` (positivo = deve, negativo = haver), status/finalização |
| `Cobranca` | Todos os passos do cálculo persistidos em Decimal; `syncOrigemId` **@unique** (idempotência); campos PIX |
| `SaldoDevedorLocacao` / `PagamentoSaldo` | Dívida de locação finalizada + quitação |
| `LogAuditoria` | Antes/depois JSON, usuário, IP, índices por data/entidade |
| `ConflitSync` | Diff campo a campo, estratégia de resolução, resolvido por/quando |

Todas as entidades sincronizáveis carregam `version` (BigInt, timestamp ms), `isDeleted` (soft-delete) e `updatedAt`.

---

## 4. Regras de cálculo (implementadas e testadas)

### Valor fixo
`dias = hoje − última cobrança (ou início)` → `períodos = max(1, ceil(dias/frequência))` (semanal 7, quinzenal 15, mensal 30) → `bruto = períodos × valor_fixo` → `+ acréscimo` → `+ saldo_devedor_anterior` = líquido final.

### Percentual a receber
`partidas = contador_atual − contador_anterior` (valida regressão) → `− desconto_partidas` → `bruto = partidas_consideradas × valor_partida + acréscimo` → `× percentual` → `− desconto_valor_receber` → `+ saldo_anterior` = líquido final.

### Percentual a pagar
Idêntico, **sem** desconto de valor; resultado é devido **ao** cliente. Saldo invertido: `saldo = pago − devido` (pagar a menos gera alerta e haver do cliente).

### Saldo devedor/haver
Restrito à locação. `novo_saldo = líquido_final − recebido` (regras a receber). Pagou a mais → haver (negativo) abatido na próxima. Na finalização, saldo > 0 vira `SaldoDevedorLocacao` cobrável pela "aba" do cliente.

Todos os cálculos retornam `passos[]` (lista discriminada para tela e recibo). Suíte Vitest cobre os exemplos do spec, inclusive precisão decimal (`0.30 × 0.3 = 0.09`, não `0.0899…`).

---

## 5. Funcionalidades implementadas

### 5.1 Autenticação e segurança
- Login CPF+senha; **login offline** no mobile (hash local após 1º acesso online).
- Access token 15min + refresh opaco 7d com **rotação**; troca de senha/desativação/mudança de permissões **revoga todas as sessões**.
- **Detecção de reuso de refresh token** (sinal de roubo → revoga tudo + auditoria), com janela de 60s para corridas benignas de multi-tab; abas sincronizam token via `storage` event.
- Rate limiting: login 5/15min por IP+CPF, sync 30/min, API 300/min (Redis; fallback memória com aviso).
- Secrets validados por Zod na subida — **sem fallback hardcoded**; app aborta sem eles.
- Logs estruturados (pino-http) com request-id e **redação** de authorization/senha/refreshToken; graceful shutdown (SIGTERM aguarda transações).

### 5.2 Cadastros (web)
- **Clientes**: CRUD, busca, múltiplos telefones, múltiplos endereços, transferência de rota (permissão própria), página de **detalhe com extrato completo** e link WhatsApp.
- **Produtos**: CRUD com auxiliares, aba **Em Depósito** (última locação finalizada p/ depósito, sem ativa).
- **Cadastros auxiliares**: tipos de produto, tamanhos, condições (CRUD em chips).
- **Rotas e Depósitos**: CRUD.
- **Usuários**: criação com seleção visual de permissões/rotas, ativar/desativar, reset de senha, **edição de permissões/rotas** de usuário existente.

### 5.3 Locações e cobranças
- Criação (web e **mobile offline**) com validação de produto disponível e endereço do cliente; contador inicial atualiza o produto (com aviso de divergência).
- Cobrança (web e mobile): prévia "Calcular" sem persistir, registro **transacional** (cobrança + saldo + contador), idempotente, toggle de campos avançados, troca de pano (subpermissão), formas: dinheiro, PIX manual, cartão, PIX Mercado Pago.
- Finalização (web e **mobile offline**): depósito (escolhe destino) ou **relocação encadeando a nova locação** com produto pré-selecionado; dívida vira `SaldoDevedorLocacao` criado pela lógica oficial do servidor (inclusive quando finalizada offline, via interceptação no sync).
- **Saldos devedores**: página web (pendentes/quitados, total em aberto, pagamento inline) e tela mobile (pagamento **online-only** por design — evita quitação dupla entre aparelhos).
- **Histórico da locação** no mobile (online com fallback local) com **reimpressão de recibo**.

### 5.4 Sincronização offline-first
- Pull incremental por `updatedAt`, filtrado pelas rotas do usuário; soft-deleted enviados para limpeza local; sync total no 1º login.
- Push em lotes (≤500) na **ordem de dependências** (clientes → endereços → locações → cobranças, cronológicas).
- **Allowlist explícita** de entidades/campos — senha não sincroniza por construção; campos injetados são descartados.
- Cobranças e locações via sync passam pelos **serviços de negócio** (recálculo, validações, saldo devedor), idempotentes pelo UUID.
- Background sync 30min (expo-background-fetch) + botão manual com contador de pendências.
- **Registros rejeitados** pelo servidor saem da fila (`SYNC_ERROR`) e vão para a tela **Pendências de Sincronização** (tentar novamente / descartar) — sem loop infinito de reenvio.

### 5.5 Conflitos — cascata de resolução
1. **Fast-forward** por `baseVersion` (ninguém editou desde o pull → aplica; independe do relógio do aparelho).
2. **Idêntico** (dados iguais → auto-resolvido).
3. **Auto-merge** de campos seguros (`observacoes`, `telefones`, `complemento`, coordenadas) preservando o resto.
4. **Fila manual**: diff campo a campo no painel, decisão por campo (servidor/aparelho), aplicar tudo do aparelho ou descartar; tudo auditado. Badge no menu com pendentes.

### 5.6 PIX Mercado Pago
- Cobrança PENDENTE → API cria pagamento (`external_reference = cobrancaId`, valor decimal sem `parseInt`), devolve QR base64 + copia-e-cola (exibidos no mobile e no painel).
- Webhook com **assinatura HMAC validada** (`timingSafeEqual`), busca o pagamento na API (não confia no body), atualiza status (PAGO/PARCIAL) e recalcula saldo **pelo engine, respeitando a regra da locação**; sempre responde 200.
- E-mail do pagador configurável (`MERCADOPAGO_PAYER_EMAIL`).

### 5.7 Vencidas
- Valor fixo: período estourado (dias de atraso + **valor estimado**). Percentual: sem leitura há N dias (configurável, padrão 30).
- Web: página com severidade por cor, total estimado, WhatsApp, badge no menu, card no dashboard.
- Mobile: **mesmo cálculo no SQLite, offline** — borda âmbar, badge "Xd atraso", filtro "somente vencidas".

### 5.8 Relatórios e auditoria
- Dashboard: faturamento do mês, inadimplência (saldos + dívidas), locações ativas, vencidas, gráfico por rota, top cobradores — agregações em queries únicas (sem N+1).
- Faturamento por período/rota com eficiência (recebido/devido), **CSV** (BOM + `;` p/ Excel BR) e **impressão/PDF** via print.
- Extrato por cliente (no detalhe do cliente).
- Auditoria: login (falhas com CPF mascarado), CRUDs, cobranças, finalizações, permissões, conflitos, PIX; tela com filtros e **linhas expansíveis antes/depois**.

### 5.9 Recibos e impressão
- PDF (expo-print) com passos discriminados do cálculo + compartilhamento.
- Buffer ESC/POS 32 colunas pronto; **import dinâmico** da lib Bluetooth: com build nativo imprime direto, sem ela degrada para PDF. Tela de pareamento com instruções de build.

### 5.10 Qualidade
- Testes unitários do engine (Vitest) + **testes de integração da API** (supertest): auth/rotação/reuso, fluxo de cobrança completo, finalização+quitação, idempotência do push, cascata de conflitos, pull por rota.
- CI GitHub Actions; seed base + **seed de demonstração** (cenário completo: vencida, parcial, dívida, cobrador de campo).
- `docs/AUDITORIA-INTERNA.md`: 12+ findings encontrados e corrigidos antes do deploy.

---

## 6. Permissões (27 chaves)

Grupos: **administração** (usuários, logs, configurações, integrações), **cadastros** (produtos, auxiliares, depósitos, rotas, clientes, transferir rota), **operações** (locação criar/editar/finalizar×2, regras, contador, cobrança, troca de pano, todas as rotas, depósito), **relatórios** (ver, PDF, Excel, outras rotas), **dispositivos** (impressão térmica). Admin do seed tem todas; cobrador demo tem o kit de campo.

---

## 7. Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` · `/refresh` · `/logout` | Auth (rate limited, rotação, reuso) |
| GET/POST/PUT/DELETE | `/api/usuarios` (+`/permissoes`) | Gestão de usuários |
| GET/POST/PUT/DELETE | `/api/clientes` (+`/:id/enderecos`) | Clientes |
| GET/POST/PUT | `/api/produtos` · GET `/produtos/em-deposito` | Produtos |
| GET/POST/DELETE | `/api/tipos-produto` · `/tamanhos` · `/condicoes` · `/rotas` · `/depositos` | Auxiliares |
| GET/POST | `/api/locacoes` | Locações |
| POST | `/api/locacoes/:id/calcular` | Prévia (não persiste) |
| POST/GET | `/api/locacoes/:id/cobrancas` | Registrar / histórico |
| POST | `/api/locacoes/:id/finalizar` | Depósito/relocação |
| GET/POST | `/api/locacoes/saldos` · `/saldos/:id/pagamentos` | Dívidas |
| POST | `/api/sync/push` · `/pull` | Sync (push com `baseVersion`) |
| GET/POST | `/api/conflitos` · `/estatisticas` · `/:id/resolver` | Conflitos |
| POST | `/api/pagamentos/webhook` | Webhook MP (HMAC, sem JWT) |
| GET | `/api/relatorios/dashboard` · `/faturamento` · `/flexivel` · `/historico-produto/:id` · `/vencidas`(+`/resumo`) · `/extrato-cliente/:id` · `/auditoria` | Relatórios |
| GET/PUT | `/api/configuracoes/integracoes` | Credenciais MP pelo painel (mascaradas) |
| GET | `/api/docs` | Documentação Swagger/OpenAPI |

---

## 8. Setup

```bash
docker compose up -d                 # Postgres 16 + Redis 7
npm install
cp .env.example .env                 # defina JWT_*_SECRET (≥32 chars) — a API não sobe sem
npm run db:generate && npm run db:push
npm run db:seed                      # admin 00000000000 / admin123 — ALTERE
npm run db:seed:demo                 # opcional: cenário completo + cobrador 11111111111/cobrador123
npm run dev                          # api :3001 + web :3000
cd apps/mobile && npx expo start     # mobile
```

**Testes:** `cd packages/shared && npm test` (engine) · `cd apps/api && npm test` (integração — banco DEDICADO, instruções em `tests/helpers.ts`). O CI roda ambos em cada push/PR.
**Produção:** API roda via `tsx` (pacotes do workspace em TS); `npm run build` = type-check; web `next build && next start`. Impressora térmica: `expo prebuild` + lib nativa (instruções na tela Impressora e seção 5.9).

---

## 9. Roadmap — o que falta implementar

Comparação item a item com o prompt original do projeto. Em ordem de prioridade sugerida:

### Alta prioridade — ✅ CONCLUÍDA
- [x] **Edição de locação**: `PUT /api/locacoes/:id` com validação de coerência da regra resultante e gates granulares (`editar_regras_locacao` para regra/valores; `alterar_contador_locacao` para o contador, que atualiza o produto). Form inline no painel ("Editar regras…") e tela mobile offline-first (`locacao-editar`, visível só com a permissão; contador apenas pelo painel — produtos não trafegam no push). Auditoria com antes/depois.
- [x] **Fluxo Rotas → Clientes no mobile**: tela inicial de rotas com contagem de clientes e de vencidas por rota (cálculo local, offline); com uma única rota, pula direto. Lista de clientes filtrada pela rota selecionada.
- [x] **API IBGE + GPS**: selects dinâmicos de estado/município (IBGE) no formulário "+ endereço" do detalhe do cliente no painel; no mobile, botão "📍 Usar localização atual" (expo-location) grava lat/long no endereço e tenta geocodificação reversa para sugerir logradouro/bairro/cidade/UF/CEP — coordenadas funcionam offline, a reversa degrada graciosamente.
- [x] **Status PIX no mobile via sync**: o pull agora inclui cobranças incrementais; o app casa pela `syncOrigemId` (cobranças deste aparelho) e atualiza status/valores — a confirmação do webhook chega ao aparelho automaticamente — e faz upsert das cobranças de outros aparelhos/painel, tornando o **histórico da locação completo offline** (com "⏳ aguardando PIX"/"parcial").

### Média prioridade — ✅ majoritariamente concluída
- [x] **Relatório flexível + pré-definidos** (spec §8): `GET /api/relatorios/flexivel?dimensao=…` com dimensões whitelisted (rota, cobrador, cliente, produto, forma de pagamento, mês, dia) × métricas (cobranças, devido, recebido, eficiência). A página de Relatórios virou um construtor com presets que cobrem os pré-definidos: comparativo de rotas, por cobrador, por cliente, produtos mais lucrativos, recebimentos por forma de pagamento e evolução mensal — todos com período e filtro de rota.
- [x] **Histórico de locações por produto**: `GET /api/relatorios/historico-produto/:id` + painel expansível na linha do produto (cliente/endereço, período, situação com depósito, nº de cobranças, total recebido).
- [x] **Exportação Excel real (.xlsx)** via SheetJS, com o botão visível apenas com `exportar_relatorios_excel` (CSV continua livre; Imprimir/PDF gated por `exportar_relatorios_pdf`).
- [x] **Histórico de pagamentos do saldo devedor no mobile**: o pull agora traz `pagamentosSaldo`, gravados na nova tabela local `pagamentos_saldo` e listados na tela da dívida — inclusive pagamentos feitos em outros aparelhos/painel.
- [x] **Troca de pano no recibo** (spec §13): "Troca de pano: SIM/não" no PDF e no ESC/POS, na emissão e na reimpressão pelo histórico.
- [x] **Configuração das chaves Mercado Pago pelo painel** (spec §10): tabela `ConfiguracaoSistema` + página **Integrações** (gated por `gerenciar_integracoes_pagamento`). Valores do painel têm precedência sobre o env (fallback); segredos saem mascarados (`••••XXXX`) com indicação da origem; cache de 60s evita SELECT por cobrança; auditoria registra **apenas quais chaves mudaram, nunca os valores**.
- [x] **Exportação PDF server-side** dos relatórios: `GET /api/relatorios/flexivel.pdf` (pdfkit, stream direto, tabela paginada com totais), gated por `exportar_relatorios_pdf`; botão "Baixar PDF" no painel via download autenticado (`apiBlob`). O "Imprimir" do navegador permanece como alternativa.

### Baixa prioridade / qualidade de vida
- [ ] **Modo escuro/claro no mobile** (spec §9).
- [x] **Bloqueio lógico de locação** (spec §6.2): `POST/DELETE /api/locacoes/:id/sinalizar-cobranca` (Redis com TTL 5min, compartilhado entre instâncias; fallback memória). Abrir a cobrança no app (online) ou no painel sinaliza e exibe aviso se outro usuário está com a mesma locação aberta — não bloqueia (offline-first não permite lock real); idempotência + conflitos seguem como defesa de fato.
- [x] **Expurgo automático de logs após 1 ano** (spec §11): job interno na API (1 min após a subida e a cada 24h, com `unref()` para não atrapalhar o shutdown) remove logs com +1 ano e registra o próprio expurgo na auditoria.
- [x] **Documentação Swagger/OpenAPI** (spec §15): especificação dos endpoints principais em `/api/docs` (Swagger UI via CDN, com exceção pontual de CSP) e `/api/docs/openapi.json`.
- [x] **Visibilidade de conflitos no mobile**: `GET /api/conflitos/meus` (só autenticação) e seção "Em revisão no escritório" na tela de Pendências — o cobrador vê quais alterações suas divergiram e aguardam decisão no painel (read-only por design: a resolução é do escritório).
- [ ] **Build pré-compilado dos pacotes** (exports map) como alternativa ao runtime via `tsx`.
- [x] **Ambiente de homologação e deploy** (spec §15): Dockerfiles da API (migrations `migrate deploy` na subida) e do painel (Next standalone), `docker-compose.homolog.yml` completo (banco+redis+api+web) e `docs/DEPLOY.md` com migrations versionadas, produção sugerida e checklist pré-produção.

### Fora de escopo (mantido conforme spec §14)
Agenda de visitas · manutenções/consertos · múltiplos contadores por produto · valor mínimo de cobrança · anexos/fotos · envio automático de recibo (WhatsApp/e-mail) · limite de crédito/bloqueio · notificações push · comissões.

> **Nota de alinhamento:** o sistema atual **excede** o spec em segurança (refresh tokens revogáveis + detecção de reuso, idempotência por índice único, allowlist de sync), resolução de conflitos (cascata com fast-forward por `baseVersion`, auto-merge e UI de diff — o spec pedia apenas "servidor vence + fila"), cobranças vencidas (web + cálculo offline no aparelho), fila de erros de sync com revisão no app, testes de integração, CI, docker-compose e seeds de demonstração. Findings e correções estão documentados em `docs/AUDITORIA-INTERNA.md`.

---

## 10. Limitações conhecidas
- `version` usa o relógio do aparelho (mitigado pelo `baseVersion` no protocolo de push).
- Rate limit sem Redis reseta por instância — obrigatório Redis em produção serverless.
- Cobranças offline muito antigas intercaladas com cobranças online podem reordenar o recálculo de saldo; auditoria e fila de conflitos dão visibilidade para correção manual.
- Pagamento de saldo devedor no mobile exige conexão (decisão de projeto contra quitação duplicada entre aparelhos).
