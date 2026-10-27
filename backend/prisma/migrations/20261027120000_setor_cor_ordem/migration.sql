-- Cor e ordem dos setores (cartões coloridos no Novo Pedido)
ALTER TABLE "setores" ADD COLUMN "cor" TEXT NOT NULL DEFAULT 'AZUL';
ALTER TABLE "setores" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;
