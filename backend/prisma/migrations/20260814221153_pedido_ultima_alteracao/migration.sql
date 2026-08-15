-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "ultima_alteracao_em" TIMESTAMP(3),
ADD COLUMN     "ultima_alteracao_por_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_ultima_alteracao_por_id_fkey" FOREIGN KEY ("ultima_alteracao_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
