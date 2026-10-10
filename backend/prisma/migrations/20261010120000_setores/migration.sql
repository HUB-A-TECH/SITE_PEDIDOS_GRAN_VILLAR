-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "setor_id" TEXT;

-- CreateTable
CREATE TABLE "setores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores_vendedores" (
    "id" TEXT NOT NULL,
    "setor_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "associado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setores_vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setores_local_id_nome_key" ON "setores"("local_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "setores_vendedores_setor_id_vendedor_id_key" ON "setores_vendedores"("setor_id", "vendedor_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setores" ADD CONSTRAINT "setores_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setores_vendedores" ADD CONSTRAINT "setores_vendedores_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setores_vendedores" ADD CONSTRAINT "setores_vendedores_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Migracao de dados: a carteira (cliente <-> vendedor, um a um) vira setores,
-- sem ninguem perder acesso no dia da atualizacao.
--  1. Agrupa os clientes pelo MESMO conjunto de vendedores (na mesma filial);
--  2. cada grupo vira um setor, chamado "Setor <vendedores>" — o admin
--     renomeia depois (ex.: "Zona Norte");
--  3. os clientes do grupo entram no setor e os vendedores viram membros.
-- Clientes sem nenhum vendedor ficam sem setor (ja eram invisiveis antes).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE "_carteira" AS
SELECT cv."cliente_id",
       c."local_id",
       string_agg(cv."vendedor_id", ',' ORDER BY cv."vendedor_id") AS "chave"
FROM "clientes_vendedores" cv
JOIN "clientes" c ON c."id" = cv."cliente_id"
GROUP BY cv."cliente_id", c."local_id";

CREATE TEMP TABLE "_grupos" AS
SELECT gen_random_uuid()::text AS "setor_id", g."local_id", g."chave"
FROM (SELECT DISTINCT "local_id", "chave" FROM "_carteira") g;

INSERT INTO "setores" ("id", "nome", "local_id", "criado_em", "atualizado_em")
SELECT g."setor_id",
       'Setor ' || (
         SELECT string_agg(v."nome_completo", ' / ' ORDER BY v."nome_completo")
         FROM "vendedores" v
         WHERE v."id" = ANY (string_to_array(g."chave", ','))
       ),
       g."local_id",
       NOW(),
       NOW()
FROM "_grupos" g;

UPDATE "clientes" c
SET "setor_id" = g."setor_id"
FROM "_carteira" k
JOIN "_grupos" g ON g."local_id" = k."local_id" AND g."chave" = k."chave"
WHERE c."id" = k."cliente_id";

INSERT INTO "setores_vendedores" ("id", "setor_id", "vendedor_id", "associado_em")
SELECT gen_random_uuid(), g."setor_id", unnest(string_to_array(g."chave", ',')), NOW()
FROM "_grupos" g;

DROP TABLE "_carteira";
DROP TABLE "_grupos";
