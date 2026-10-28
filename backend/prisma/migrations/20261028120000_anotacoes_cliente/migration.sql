-- CreateTable
CREATE TABLE "anotacoes_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "texto" TEXT NOT NULL,
    "fixada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editado_em" TIMESTAMP(3),

    CONSTRAINT "anotacoes_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anotacoes_cliente_cliente_id_criado_em_idx" ON "anotacoes_cliente"("cliente_id", "criado_em");

-- AddForeignKey
ALTER TABLE "anotacoes_cliente" ADD CONSTRAINT "anotacoes_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacoes_cliente" ADD CONSTRAINT "anotacoes_cliente_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
