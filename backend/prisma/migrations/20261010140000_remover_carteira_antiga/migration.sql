-- A carteira antiga (vinculo cliente <-> vendedor um a um) foi substituida
-- pelos setores na migration 20261010120000_setores, que copiou todos os
-- vinculos para setores. Removida depois que o deploy dos setores entrou no ar.

-- DropForeignKey
ALTER TABLE "clientes_vendedores" DROP CONSTRAINT "clientes_vendedores_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "clientes_vendedores" DROP CONSTRAINT "clientes_vendedores_vendedor_id_fkey";

-- DropTable
DROP TABLE "clientes_vendedores";
