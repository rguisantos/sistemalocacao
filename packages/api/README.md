# @app/api — Fase 1 (caminho crítico de segurança)

API NestJS sobre `@app/core`. Esta entrega cobre o núcleo de segurança e um módulo CRUD de referência.

## Fluxo de cada requisição
1. **RateLimitGuard** — limite persistente em Redis nas rotas marcadas (`/auth/login`, `/auth/refresh`). [AUDIT P0]
2. **JwtAuthGuard** — valida assinatura **e** confere `tokenVersao` contra o banco (revogação instantânea). Rotas `@Publico()` passam direto. [AUDIT P0]
3. **PermissoesGuard** — exige as permissões declaradas via `@RequerPermissoes(...)`, validadas **no servidor**. [AUDIT P1]
4. **AuditoriaService** — registra mutações, removendo `senha`/tokens dos dados. [AUDIT P2]

## Pronto nesta entrega
- Validação de ambiente no boot (sem `JWT_SECRET` forte a app não sobe). [AUDIT P0]
- `auth`: login (argon2id), refresh, logout global (incrementa `tokenVersao`).
- Guards globais (rate limit, JWT+revogação, permissões) e decorators.
- Auditoria com sanitização de campos sensíveis.
- `clientes`: CRUD de referência com **filtro por rota anti-IDOR**, **concorrência otimista** (`version`) e **soft-delete** (tombstone do sync). [AUDIT P0/P1]
- Catálogo de permissões + papéis-preset (`prisma-seed/permissoes.ts`).
- Swagger em `/docs`.

## CRUDs da Fase 1 (completos)
- **`usuarios`**: senha argon2id, atribuição de rotas e permissões, **papéis-preset** (Administrador/Secretário/AcessoControlado), reset de senha que **revoga sessões** (incrementa `tokenVersao`), projeção sem senha.
- **`produtos`**: CRUD, **alterar contador** em endpoint com permissão própria e auditado, listagem **"em depósito"**, plaqueta única tratada.
- **`rotas`, `depositos`, `auxiliares`** (tipos/tamanhos/condições): CRUD via base genérica `CadastroCrudService` (soft-delete + auditoria + concorrência otimista).
- **`enderecos`**: CRUD com isolamento por rota do cliente (anti-IDOR).
- **`clientes`**: + endpoint dedicado de **transferência de rota** (permissão própria).
- **Seed** (`prisma-seed/seed.ts`): popula permissões e cria o admin inicial.

Backend completo do servidor: login → cadastros → locação → cobrança → saldo → sincronização offline.

## Rodar
```bash
npm install                      # na raiz do monorepo
cp packages/api/.env.example packages/api/.env   # ajuste os valores
npm -w @app/core run build
npm -w @app/api run prisma:generate
npm -w @app/api run prisma:migrate
npm -w @app/api run start:dev    # Swagger em http://localhost:3000/docs
```

## Fase 2 — Domínio de cobrança (entregue)
- **`locacoes`**: criação com trava de **uma locação ativa por produto** (`chaveProdutoAtivo` + constraint única); **finalização** para depósito ou **relocação** (abre nova locação do mesmo produto e transfere a pendência para `SaldoDevedorLocacao`); permissão por tipo validada no servidor.
- **`cobrancas`**: registro usando o motor `@app/core` (valor fixo e percentual), com:
  - **snapshot** do cálculo e da regra (`regraSnapshot`/`regraVersaoSnapshot`) — reproduzível, imune a mudança de regra futura;
  - **idempotência** por UUID gerado no cliente (reenvio devolve a mesma cobrança);
  - **pagamento append-only** (`Pagamento`), nunca sobrescrito;
  - **saldo derivado** do histórico (`SaldoService`: Σ base − Σ pagamentos), nunca confiado do cliente;
  - **troca de pano** gera `Manutencao` vinculada; contador do produto atualizado no modo percentual;
  - **alerta** quando, em "percentual a pagar", o valor pago é inferior ao devido;
  - tudo em transação.

### Fluxo do registro de cobrança
`POST /cobrancas` → carrega locação → referência = última cobrança (ou início) → `@app/core` calcula → grava cobrança (snapshot) + pagamento (append-only) + manutenção (se troca de pano) → recalcula saldo do histórico → auditoria.

## Aba de saldo devedor (entregue)
- **`saldo-devedor`**: lista pendências de locações finalizadas por cliente e registra **pagamento direto append-only**; ao zerar, o registro vira `QUITADO` (a aba some no mobile). Idempotente por UUID do pagamento.

## Fase 3 — Sincronização (entregue)
- **`POST /sync/pull`**: baixa mudanças incrementais por `updatedAt`, **com tombstones** (registros `deletedAt`), **escopadas por rota** do usuário (anti-IDOR + payload), e retorna o **`serverTimestamp`** (relógio do servidor) para o próximo ciclo. `usuario` nunca traz `senha`/`tokenVersao`.
- **`POST /sync/push`**: aplica a **allowlist por entidade** (`sanitizarPush`), resolve via `resolver` (**append-only** para cobrança/pagamento = idempotente; **versionado** com concorrência otimista para o resto), registra **conflitos** em `ConflitoSincronizacao` (servidor vence), e **recalcula o saldo** das locações/saldos afetados a partir do histórico recém-recebido — nunca confia no valor do cliente. **Idempotente por lote** (`idempotencyKey`).
- Rate limit persistente aplicado a `/sync/pull` e `/sync/push`.

## Fase 6 — Integrações (entregue)
- **Mercado Pago (PIX)** (`integracao`): credenciais **criptografadas at-rest** (AES-256-GCM, `CONFIG_SECRET`); criação de cobrança PIX (QR + copia-e-cola); **webhook validado por assinatura HMAC** (rejeita adulteração), **idempotente** por `pixId`, que registra o pagamento append-only e **recalcula o saldo**. Reconciliação por consulta de status.
- **Relatórios** (`relatorios`): endpoint `dashboard` (faturamento do mês, inadimplência, locações ativas, faturamento por rota — agregações reais que o painel web consome), `faturamento-por-rota`, `inadimplencia`, e **exportação PDF/Excel** (padrão reutilizável).
- **Notificações** (`notificacoes`): Expo Push; **job diário de inadimplência** reusando `vencidaValorFixo`/`vencidaPercentual` do `@app/core`, **idempotente por dia** (Redis), com limpeza de tokens inválidos; envio manual pelo painel.

Validação (harness com `crypto` nativo): criptografia ida-e-volta, assinatura do webhook e idempotência — 9/9.
