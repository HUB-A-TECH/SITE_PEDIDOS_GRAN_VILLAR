-- O vendedor agora pode ter varios pedidos salvos (RASCUNHO) ao mesmo tempo,
-- um por cliente visitado, em vez de um unico rascunho geral.

-- 1) Remove a restricao antiga (1 rascunho por vendedor).
DROP INDEX IF EXISTS "pedidos_um_rascunho_por_vendedor";

-- 2) Novo indice unico parcial: no maximo um rascunho por (vendedor, cliente).
CREATE UNIQUE INDEX "pedidos_um_rascunho_por_vendedor_cliente"
  ON "pedidos" ("vendedor_id", "cliente_id")
  WHERE status = 'RASCUNHO';
