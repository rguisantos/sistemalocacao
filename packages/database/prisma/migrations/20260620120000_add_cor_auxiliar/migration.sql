-- Cadastro auxiliar de Cor + referência opcional em Produto.
-- Aditivo e seguro: não remove nada; `Produto.descricao` (texto da cor) permanece
-- intacto e continua trafegando no sync. `corId` é opcional e usado apenas no painel web.

-- CreateTable
CREATE TABLE "Cor" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cor_updatedAt_idx" ON "Cor"("updatedAt");

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN "corId" UUID;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_corId_fkey" FOREIGN KEY ("corId") REFERENCES "Cor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
