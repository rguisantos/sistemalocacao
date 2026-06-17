-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "RegraCobranca" AS ENUM ('VALOR_FIXO', 'PERCENTUAL_A_RECEBER', 'PERCENTUAL_A_PAGAR');

-- CreateEnum
CREATE TYPE "Frequencia" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL');

-- CreateEnum
CREATE TYPE "StatusLocacao" AS ENUM ('ATIVA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "TipoFinalizacao" AS ENUM ('DEPOSITO', 'RELOCACAO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'PARCIAL');

-- CreateEnum
CREATE TYPE "StatusSaldo" AS ENUM ('PENDENTE', 'QUITADO');

-- CreateEnum
CREATE TYPE "TipoManutencao" AS ENUM ('TROCA_PANO', 'CONSERTO', 'LIMPEZA', 'OUTROS');

-- CreateEnum
CREATE TYPE "AlvoPagamento" AS ENUM ('COBRANCA', 'SALDO_DEVEDOR_LOCACAO');

-- CreateTable
CREATE TABLE "TipoProduto" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TipoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tamanho" (
    "id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tamanho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condicao" (
    "id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Condicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposito" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rota" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Rota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pushToken" TEXT,
    "tokenVersao" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permissao" (
    "id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioRota" (
    "usuarioId" UUID NOT NULL,
    "rotaId" UUID NOT NULL,

    CONSTRAINT "UsuarioRota_pkey" PRIMARY KEY ("usuarioId","rotaId")
);

-- CreateTable
CREATE TABLE "UsuarioPermissao" (
    "usuarioId" UUID NOT NULL,
    "permissaoId" UUID NOT NULL,

    CONSTRAINT "UsuarioPermissao_pkey" PRIMARY KEY ("usuarioId","permissaoId")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" UUID NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "rgIe" TEXT,
    "telefones" JSONB NOT NULL DEFAULT '[]',
    "observacoes" TEXT,
    "rotaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endereco" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" UUID NOT NULL,
    "plaqueta" TEXT NOT NULL,
    "tipoId" UUID NOT NULL,
    "descricao" TEXT,
    "tamanhoId" UUID NOT NULL,
    "condicaoId" UUID NOT NULL,
    "chave" TEXT,
    "contador" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locacao" (
    "id" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "enderecoId" UUID NOT NULL,
    "regra" "RegraCobranca" NOT NULL,
    "frequencia" "Frequencia",
    "valorFixo" DECIMAL(12,2),
    "valorPartida" DECIMAL(12,2),
    "percentual" DECIMAL(7,4),
    "contadorInicial" INTEGER NOT NULL DEFAULT 0,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "status" "StatusLocacao" NOT NULL DEFAULT 'ATIVA',
    "finalizacaoTipo" "TipoFinalizacao",
    "depositoId" UUID,
    "relocadaParaId" UUID,
    "saldoDevedorAtual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "regraVersao" INTEGER NOT NULL DEFAULT 1,
    "chaveProdutoAtivo" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Locacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" UUID NOT NULL,
    "locacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "dataCobranca" TIMESTAMP(3) NOT NULL,
    "regraSnapshot" "RegraCobranca" NOT NULL,
    "regraVersaoSnapshot" INTEGER NOT NULL,
    "contadorAnterior" INTEGER,
    "contadorAtual" INTEGER,
    "contadorReiniciado" BOOLEAN NOT NULL DEFAULT false,
    "partidasJogadas" INTEGER,
    "descontoPartidas" INTEGER NOT NULL DEFAULT 0,
    "partidasConsideradas" INTEGER,
    "acrescimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorBruto" DECIMAL(12,2),
    "valorPercentual" DECIMAL(12,2),
    "descontoValorReceber" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorLiquidoBase" DECIMAL(12,2) NOT NULL,
    "saldoDevedorAnterior" DECIMAL(12,2) NOT NULL,
    "valorLiquidoFinal" DECIMAL(12,2) NOT NULL,
    "trocaPano" BOOLEAN NOT NULL DEFAULT false,
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "pixId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" UUID NOT NULL,
    "alvo" "AlvoPagamento" NOT NULL,
    "cobrancaId" UUID,
    "saldoId" UUID,
    "usuarioId" UUID NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "pixId" TEXT,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "estornadoPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoDevedorLocacao" (
    "id" UUID NOT NULL,
    "locacaoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "produtoDescricao" TEXT NOT NULL,
    "valorOriginal" DECIMAL(12,2) NOT NULL,
    "valorRestante" DECIMAL(12,2) NOT NULL,
    "status" "StatusSaldo" NOT NULL DEFAULT 'PENDENTE',
    "dataQuitacao" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SaldoDevedorLocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manutencao" (
    "id" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "cobrancaId" UUID,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoManutencao" NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Manutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" UUID NOT NULL,
    "usuarioId" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflitoSincronizacao" (
    "id" UUID NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "versaoServidor" INTEGER NOT NULL,
    "versaoCliente" INTEGER NOT NULL,
    "dadosCliente" JSONB NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflitoSincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "valorCriptografado" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipoProduto_updatedAt_idx" ON "TipoProduto"("updatedAt");

-- CreateIndex
CREATE INDEX "Tamanho_updatedAt_idx" ON "Tamanho"("updatedAt");

-- CreateIndex
CREATE INDEX "Condicao_updatedAt_idx" ON "Condicao"("updatedAt");

-- CreateIndex
CREATE INDEX "Deposito_updatedAt_idx" ON "Deposito"("updatedAt");

-- CreateIndex
CREATE INDEX "Rota_updatedAt_idx" ON "Rota"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE INDEX "Usuario_updatedAt_idx" ON "Usuario"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permissao_chave_key" ON "Permissao"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE INDEX "Cliente_rotaId_idx" ON "Cliente"("rotaId");

-- CreateIndex
CREATE INDEX "Cliente_updatedAt_idx" ON "Cliente"("updatedAt");

-- CreateIndex
CREATE INDEX "Endereco_clienteId_idx" ON "Endereco"("clienteId");

-- CreateIndex
CREATE INDEX "Endereco_updatedAt_idx" ON "Endereco"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_plaqueta_key" ON "Produto"("plaqueta");

-- CreateIndex
CREATE INDEX "Produto_updatedAt_idx" ON "Produto"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Locacao_chaveProdutoAtivo_key" ON "Locacao"("chaveProdutoAtivo");

-- CreateIndex
CREATE INDEX "Locacao_produtoId_idx" ON "Locacao"("produtoId");

-- CreateIndex
CREATE INDEX "Locacao_clienteId_idx" ON "Locacao"("clienteId");

-- CreateIndex
CREATE INDEX "Locacao_status_idx" ON "Locacao"("status");

-- CreateIndex
CREATE INDEX "Locacao_updatedAt_idx" ON "Locacao"("updatedAt");

-- CreateIndex
CREATE INDEX "Cobranca_locacaoId_dataCobranca_idx" ON "Cobranca"("locacaoId", "dataCobranca");

-- CreateIndex
CREATE INDEX "Cobranca_usuarioId_idx" ON "Cobranca"("usuarioId");

-- CreateIndex
CREATE INDEX "Cobranca_updatedAt_idx" ON "Cobranca"("updatedAt");

-- CreateIndex
CREATE INDEX "Pagamento_cobrancaId_idx" ON "Pagamento"("cobrancaId");

-- CreateIndex
CREATE INDEX "Pagamento_saldoId_idx" ON "Pagamento"("saldoId");

-- CreateIndex
CREATE INDEX "Pagamento_updatedAt_idx" ON "Pagamento"("updatedAt");

-- CreateIndex
CREATE INDEX "SaldoDevedorLocacao_clienteId_idx" ON "SaldoDevedorLocacao"("clienteId");

-- CreateIndex
CREATE INDEX "SaldoDevedorLocacao_status_idx" ON "SaldoDevedorLocacao"("status");

-- CreateIndex
CREATE INDEX "SaldoDevedorLocacao_updatedAt_idx" ON "SaldoDevedorLocacao"("updatedAt");

-- CreateIndex
CREATE INDEX "Manutencao_produtoId_idx" ON "Manutencao"("produtoId");

-- CreateIndex
CREATE INDEX "Manutencao_updatedAt_idx" ON "Manutencao"("updatedAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "ConflitoSincronizacao_entidade_entidadeId_idx" ON "ConflitoSincronizacao"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "ConflitoSincronizacao_resolvido_idx" ON "ConflitoSincronizacao"("resolvido");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracao_chave_key" ON "Configuracao"("chave");

-- AddForeignKey
ALTER TABLE "UsuarioRota" ADD CONSTRAINT "UsuarioRota_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRota" ADD CONSTRAINT "UsuarioRota_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "Rota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_permissaoId_fkey" FOREIGN KEY ("permissaoId") REFERENCES "Permissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "Rota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tamanhoId_fkey" FOREIGN KEY ("tamanhoId") REFERENCES "Tamanho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_condicaoId_fkey" FOREIGN KEY ("condicaoId") REFERENCES "Condicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "Endereco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_locacaoId_fkey" FOREIGN KEY ("locacaoId") REFERENCES "Locacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_saldoId_fkey" FOREIGN KEY ("saldoId") REFERENCES "SaldoDevedorLocacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoDevedorLocacao" ADD CONSTRAINT "SaldoDevedorLocacao_locacaoId_fkey" FOREIGN KEY ("locacaoId") REFERENCES "Locacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoDevedorLocacao" ADD CONSTRAINT "SaldoDevedorLocacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
