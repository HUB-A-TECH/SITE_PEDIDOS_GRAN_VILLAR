/*
  Warnings:

  - You are about to drop the `produtos_locais` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "produtos_locais" DROP CONSTRAINT "produtos_locais_local_id_fkey";

-- DropForeignKey
ALTER TABLE "produtos_locais" DROP CONSTRAINT "produtos_locais_produto_id_fkey";

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "nome_comprador" TEXT,
ADD COLUMN     "tabela_preco_id" TEXT,
ADD COLUMN     "telefone_comprador" TEXT;

-- DropTable
DROP TABLE "produtos_locais";

-- CreateTable
CREATE TABLE "tabelas_preco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabelas_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabelas_preco_itens" (
    "id" TEXT NOT NULL,
    "tabela_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "tabelas_preco_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_vendedores" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "associado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabelas_preco_nome_key" ON "tabelas_preco"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tabelas_preco_itens_tabela_id_produto_id_key" ON "tabelas_preco_itens"("tabela_id", "produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_vendedores_cliente_id_vendedor_id_key" ON "clientes_vendedores"("cliente_id", "vendedor_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabelas_preco_itens" ADD CONSTRAINT "tabelas_preco_itens_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabelas_preco_itens" ADD CONSTRAINT "tabelas_preco_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_vendedores" ADD CONSTRAINT "clientes_vendedores_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_vendedores" ADD CONSTRAINT "clientes_vendedores_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Migracao de dados (nada muda para o usuario no dia da atualizacao):
--  1. cria a "Tabela Padrao" com os precos atuais do catalogo;
--  2. coloca todos os clientes existentes nessa tabela;
--  3. vincula cada cliente aos vendedores da MESMA filial, preservando
--     exatamente o acesso que existia antes da carteira por vendedor.
-- ---------------------------------------------------------------------------
INSERT INTO "tabelas_preco" ("id", "nome", "descricao", "ativo", "criado_em", "atualizado_em")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Tabela Padrão',
  'Preços do catálogo. Tabela inicial de todos os clientes.',
  true,
  NOW(),
  NOW()
);

INSERT INTO "tabelas_preco_itens" ("id", "tabela_id", "produto_id", "preco")
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001', p."id", p."preco"
FROM "produtos" p;

UPDATE "clientes"
SET "tabela_preco_id" = '00000000-0000-4000-8000-000000000001'
WHERE "tabela_preco_id" IS NULL;

INSERT INTO "clientes_vendedores" ("id", "cliente_id", "vendedor_id", "associado_em")
SELECT gen_random_uuid(), c."id", v."id", NOW()
FROM "clientes" c
JOIN "vendedores" v ON v."local_id" = c."local_id";
