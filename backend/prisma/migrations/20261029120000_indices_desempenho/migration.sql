-- CreateIndex
CREATE INDEX "clientes_setor_id_idx" ON "clientes"("setor_id");

-- CreateIndex
CREATE INDEX "clientes_local_id_idx" ON "clientes"("local_id");

-- CreateIndex
CREATE INDEX "itens_pedido_pedido_id_idx" ON "itens_pedido"("pedido_id");

-- CreateIndex
CREATE INDEX "itens_pedido_produto_id_idx" ON "itens_pedido"("produto_id");

-- CreateIndex
CREATE INDEX "pedidos_vendedor_id_status_idx" ON "pedidos"("vendedor_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_status_idx" ON "pedidos"("cliente_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_status_confirmado_em_idx" ON "pedidos"("status", "confirmado_em");

-- CreateIndex
CREATE INDEX "setores_vendedores_vendedor_id_idx" ON "setores_vendedores"("vendedor_id");

