-- Garante no banco a regra "um rascunho por vendedor" (RN-04).

-- 1) Remove rascunhos duplicados, mantendo o mais recente por vendedor.
DELETE FROM "pedidos" p
USING "pedidos" q
WHERE p.status = 'RASCUNHO'
  AND q.status = 'RASCUNHO'
  AND p.vendedor_id = q.vendedor_id
  AND p.criado_em < q.criado_em;

-- 2) Índice único parcial: no máximo um pedido RASCUNHO por vendedor.
CREATE UNIQUE INDEX "pedidos_um_rascunho_por_vendedor"
  ON "pedidos" ("vendedor_id")
  WHERE status = 'RASCUNHO';
