# Plano de migração dos dados existentes

Há sistemas em operação (web `appcobrancas` em PostgreSQL e o mobile em SQLite). A migração para o
novo schema é feita por um ETL idempotente, com janela curta e reconciliação.

## Princípios
- **Idempotente por chave natural**: mapear cada registro antigo a um UUID determinístico (ex.: `uuidv5(namespace, tabela+id_antigo)`), para reprocessar sem duplicar.
- **Conversões obrigatórias** (decisões da auditoria):
  - Monetário `Float` → `Decimal(12,2)` (arredondar HALF_UP na conversão).
  - Datas em texto → `DateTime` (no fuso `America/Sao_Paulo`).
  - Permissões soltas → `Permissao` + `UsuarioPermissao` (mapear via catálogo/papéis).
- **Saldo não é migrado como verdade**: importar o histórico de cobranças/pagamentos e **re-derivar** o saldo com `recalcularSaldoLocacao` — a fonte da verdade passa a ser o histórico append-only.
- **Preservar histórico**: cobranças/pagamentos antigos entram como registros imutáveis.

## Etapas
1. **Congelar** o sistema antigo (janela de manutenção) e tirar dump.
2. **Dry-run** do ETL contra uma cópia: gera relatório de divergências (contagens, somatórios por rota/cliente) sem gravar.
3. Rodar o ETL real em transação por entidade, na ordem de dependência: auxiliares → rotas → usuários/permissões → produtos → clientes/endereços → locações → cobranças → pagamentos → saldos.
4. **Reconciliação**: comparar somatório de faturamento e inadimplência antigo × novo; abortar se divergir além da tolerância de arredondamento.
5. **Cutover**: apontar web/mobile para a nova API; manter o antigo em leitura por um período.

## Reconciliação contínua
Os dispositivos móveis re-sincronizam do zero (`fullSync`) no primeiro login na nova API, recebendo o
estado canônico já migrado.

---

## Migrations Prisma versionadas (a partir de `0_init`)

O schema agora tem uma migration inicial em `packages/database/prisma/migrations/0_init/` —
saímos do `prisma db push` para um histórico versionado. O `migration_lock.toml` fixa o provider `postgresql`.

### Verificar que o SQL bate com o schema (autoritativo) — fazer 1x antes de confiar
O `0_init/migration.sql` foi escrito a partir do schema seguindo as convenções do Prisma e validado por
checagem estrutural (20 tabelas, 10 enums, 23 FKs, tipos/defaults/ações). Para garantir byte-a-byte, gere o
SQL pelo próprio Prisma e compare:
```bash
cd packages/api
npm run prisma:migrate:verify > /tmp/autoritativo.sql
diff <(grep -v '^--' ../database/prisma/migrations/0_init/migration.sql) <(grep -v '^--' /tmp/autoritativo.sql)
```
Se o diff vier vazio (ignorando comentários/espaços), está idêntico. Se houver diferença, troque o conteúdo
do `0_init/migration.sql` pelo gerado — o Prisma é a fonte da verdade.

### Banco NOVO (do zero)
```bash
cd packages/api
npm run prisma:migrate:deploy   # aplica 0_init (e futuras) — prod e CI
npm run prisma:generate
```

### Banco JÁ EXISTENTE (criado antes via `db push`) — baseline sem recriar tabelas
As tabelas já existem; só registramos a migration como aplicada (não roda o SQL):
```bash
cd packages/api
npm run prisma:migrate:baseline   # prisma migrate resolve --applied 0_init
npm run prisma:migrate:status     # deve mostrar tudo aplicado
```

### Evoluções futuras (dev)
Mudou o schema? Gere a próxima migration (cria o arquivo + aplica no banco de dev):
```bash
cd packages/api
npm run prisma:migrate   # prisma migrate dev  -> cria migrations/<timestamp>_<nome>/
```
Em produção/CI roda só `prisma:migrate:deploy` (nunca `migrate dev`).

### O que mudou no CI
O job e2e passou de `prisma db push` para `prisma migrate deploy` — assim a própria migration é exercitada a
cada push (valida o SQL de ponta a ponta contra um Postgres limpo, com paridade de produção).
