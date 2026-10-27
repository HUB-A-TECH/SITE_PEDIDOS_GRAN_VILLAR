-- Categorias passam a ser uma tabela editável pelo admin.
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- As 7 categorias fixas de antes, na mesma ordem.
INSERT INTO "categorias" ("id", "nome", "ordem", "atualizado_em") VALUES
  (gen_random_uuid()::text, 'Alhos', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Pimentas', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Chás', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Ervas', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Especiarias', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Sais', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Outros', 6, CURRENT_TIMESTAMP);

ALTER TABLE "produtos" ADD COLUMN "categoria_id" TEXT;

-- Cada produto vai para a categoria nova equivalente à antiga.
UPDATE "produtos" p SET "categoria_id" = c."id"
FROM "categorias" c
WHERE c."nome" = CASE p."categoria"::text
  WHEN 'ALHOS' THEN 'Alhos'
  WHEN 'PIMENTAS' THEN 'Pimentas'
  WHEN 'CHAS' THEN 'Chás'
  WHEN 'ERVAS' THEN 'Ervas'
  WHEN 'ESPECIARIAS' THEN 'Especiarias'
  WHEN 'SAIS' THEN 'Sais'
  ELSE 'Outros'
END;

-- A coluna antiga fica (com padrão) para o site anterior seguir funcionando.
ALTER TABLE "produtos" ALTER COLUMN "categoria" SET DEFAULT 'OUTROS';

CREATE INDEX "produtos_categoria_id_idx" ON "produtos"("categoria_id");
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
