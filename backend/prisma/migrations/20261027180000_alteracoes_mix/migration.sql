-- Histórico do mix do cliente (só cria coisas novas; nada existente muda).

-- CreateEnum
CREATE TYPE "AcaoMix" AS ENUM ('ADICIONADO_NO_PEDIDO', 'ADICIONADO_AO_MIX', 'REMOVIDO_DO_MIX');

-- CreateTable
CREATE TABLE "alteracoes_mix" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "acao" "AcaoMix" NOT NULL,
    "usuario_id" TEXT,
    "pedido_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alteracoes_mix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alteracoes_mix_cliente_id_criado_em_idx" ON "alteracoes_mix"("cliente_id", "criado_em");

-- AddForeignKey
ALTER TABLE "alteracoes_mix" ADD CONSTRAINT "alteracoes_mix_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracoes_mix" ADD CONSTRAINT "alteracoes_mix_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracoes_mix" ADD CONSTRAINT "alteracoes_mix_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
