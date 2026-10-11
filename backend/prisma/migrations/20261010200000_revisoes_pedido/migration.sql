-- Revisoes do comercial que alteraram o pedido: o que mudou em relacao ao que
-- o vendedor enviou, quem mudou, quando e se o vendedor ja viu.

-- CreateTable
CREATE TABLE "revisoes_pedido" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "revisado_por_id" TEXT NOT NULL,
    "revisado_em" TIMESTAMP(3) NOT NULL,
    "alteracoes" JSONB NOT NULL,
    "total_antes" DECIMAL(10,2) NOT NULL,
    "total_depois" DECIMAL(10,2) NOT NULL,
    "visto_pelo_vendedor_em" TIMESTAMP(3),
    "superada_em" TIMESTAMP(3),

    CONSTRAINT "revisoes_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revisoes_pedido_pedido_id_idx" ON "revisoes_pedido"("pedido_id");

-- AddForeignKey
ALTER TABLE "revisoes_pedido" ADD CONSTRAINT "revisoes_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisoes_pedido" ADD CONSTRAINT "revisoes_pedido_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
