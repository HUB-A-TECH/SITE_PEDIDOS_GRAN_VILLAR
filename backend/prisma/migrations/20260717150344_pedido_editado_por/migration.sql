-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "editado_em" TIMESTAMP(3),
ADD COLUMN     "editado_por_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_editado_por_id_fkey" FOREIGN KEY ("editado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
