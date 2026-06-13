-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateEnum
CREATE TYPE "RegraCobranca" AS ENUM ('VALOR_FIXO', 'PERCENTUAL_A_RECEBER', 'PERCENTUAL_A_PAGAR');

-- CreateEnum
CREATE TYPE "FrequenciaCobranca" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL');

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
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING_CREATE', 'PENDING_UPDATE', 'PENDING_DELETE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'geral',

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_permissoes" (
    "usuario_id" TEXT NOT NULL,
    "permissao_id" TEXT NOT NULL,

    CONSTRAINT "usuario_permissoes_pkey" PRIMARY KEY ("usuario_id","permissao_id")
);

-- CreateTable
CREATE TABLE "rotas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rotas" (
    "usuario_id" TEXT NOT NULL,
    "rota_id" TEXT NOT NULL,

    CONSTRAINT "usuario_rotas_pkey" PRIMARY KEY ("usuario_id","rota_id")
);

-- CreateTable
CREATE TABLE "depositos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tamanhos" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tamanhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condicoes" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "plaqueta" TEXT NOT NULL,
    "tipo_produto_id" TEXT NOT NULL,
    "descricao" TEXT,
    "tamanho_id" TEXT,
    "condicao_id" TEXT,
    "chave" TEXT,
    "contador" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPessoa" NOT NULL DEFAULT 'PESSOA_FISICA',
    "nome" TEXT NOT NULL,
    "razao_social" TEXT,
    "cpf_cnpj" TEXT,
    "rg_inscricao_estadual" TEXT,
    "telefones" JSONB NOT NULL DEFAULT '[]',
    "rota_id" TEXT NOT NULL,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locacoes" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "endereco_id" TEXT NOT NULL,
    "regra" "RegraCobranca" NOT NULL,
    "frequencia" "FrequenciaCobranca",
    "valor_fixo" DECIMAL(10,2),
    "valor_partida" DECIMAL(10,4),
    "percentual" DECIMAL(5,4),
    "contador_inicial" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "status" "StatusLocacao" NOT NULL DEFAULT 'ATIVA',
    "finalizacao_tipo" "TipoFinalizacao",
    "deposito_id" TEXT,
    "saldo_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "locacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "data_cobranca" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contador_anterior" INTEGER,
    "contador_atual" INTEGER,
    "partidas_jogadas" INTEGER,
    "desconto_partidas" INTEGER DEFAULT 0,
    "partidas_consideradas" INTEGER,
    "valor_bruto" DECIMAL(10,2) NOT NULL,
    "acrescimo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_percentual" DECIMAL(10,2),
    "desconto_valor_receber" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_liquido_base" DECIMAL(10,2) NOT NULL,
    "saldo_devedor_anterior" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_liquido_final" DECIMAL(10,2) NOT NULL,
    "valor_recebido_pago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saldo_resultante" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "forma_pagamento" "FormaPagamento" NOT NULL DEFAULT 'DINHEIRO',
    "pix_id" TEXT,
    "pix_qr_code" TEXT,
    "pix_copia_cola" TEXT,
    "status_pagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "troca_pano" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "sincronizado" BOOLEAN NOT NULL DEFAULT true,
    "sync_origem_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_devedores_locacao" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "valor_original" DECIMAL(10,2) NOT NULL,
    "valor_restante" DECIMAL(10,2) NOT NULL,
    "status" "StatusSaldo" NOT NULL DEFAULT 'PENDENTE',
    "data_quitacao" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "saldos_devedores_locacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_saldo" (
    "id" TEXT NOT NULL,
    "saldo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma_pagamento" "FormaPagamento" NOT NULL,
    "data_pagamento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_saldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_sistema" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflitos_sync" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "dados_mobile" JSONB NOT NULL,
    "dados_servidor" JSONB NOT NULL,
    "campos_conflitantes" JSONB NOT NULL DEFAULT '[]',
    "usuario_origem_id" TEXT,
    "device_id" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolucao" TEXT,
    "dados_resolvidos" JSONB,
    "resolvido_por" TEXT,
    "resolvido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflitos_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_chave_key" ON "permissoes"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_produto_nome_key" ON "tipos_produto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tamanhos_descricao_key" ON "tamanhos"("descricao");

-- CreateIndex
CREATE UNIQUE INDEX "condicoes_descricao_key" ON "condicoes"("descricao");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_plaqueta_key" ON "produtos"("plaqueta");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_sync_origem_id_key" ON "cobrancas"("sync_origem_id");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_devedores_locacao_locacao_id_key" ON "saldos_devedores_locacao"("locacao_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_created_at_idx" ON "logs_auditoria"("created_at");

-- CreateIndex
CREATE INDEX "logs_auditoria_usuario_id_idx" ON "logs_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidade_id_idx" ON "logs_auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "conflitos_sync_resolvido_created_at_idx" ON "conflitos_sync"("resolvido", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rotas" ADD CONSTRAINT "usuario_rotas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rotas" ADD CONSTRAINT "usuario_rotas_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tipo_produto_id_fkey" FOREIGN KEY ("tipo_produto_id") REFERENCES "tipos_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tamanho_id_fkey" FOREIGN KEY ("tamanho_id") REFERENCES "tamanhos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_condicao_id_fkey" FOREIGN KEY ("condicao_id") REFERENCES "condicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_endereco_id_fkey" FOREIGN KEY ("endereco_id") REFERENCES "enderecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_devedores_locacao" ADD CONSTRAINT "saldos_devedores_locacao_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_devedores_locacao" ADD CONSTRAINT "saldos_devedores_locacao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_saldo" ADD CONSTRAINT "pagamentos_saldo_saldo_id_fkey" FOREIGN KEY ("saldo_id") REFERENCES "saldos_devedores_locacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

