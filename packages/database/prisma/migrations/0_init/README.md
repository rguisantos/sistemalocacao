# Migration 0_init

Migração inicial gerada a partir do schema (saída do `prisma db push` para histórico versionado).
Cobre os 10 enums, 20 tabelas (13 com `version` p/ concorrência otimista), índices (incl. o único
`Locacao_chaveProdutoAtivo_key` que garante 1 locação ATIVA por produto) e 23 FKs (RESTRICT em
relações obrigatórias, SET NULL nas opcionais: depositoId, cobrancaId, saldoId).

Para conferir contra o gerador autoritativo do Prisma e o fluxo de baseline, ver `MIGRACAO.md` na raiz.
