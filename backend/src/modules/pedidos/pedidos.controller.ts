import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Vendedor } from '@prisma/client';
import * as service from './pedidos.service';
import { isUniqueConstraintError } from '../../utils/prisma-errors';

type PedidoComItens = NonNullable<
  Awaited<ReturnType<typeof service.getRascunhoAtual>>
>;

function serialize(p: PedidoComItens) {
  return {
    id: p.id,
    clienteId: p.clienteId,
    status: p.status,
    observacoes: p.observacoes,
    subtotal: Number(p.subtotal),
    total: Number(p.total),
    cliente: {
      id: p.cliente.id,
      codigo: p.cliente.codigo,
      nome: p.cliente.nome,
    },
    itens: p.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      produto: {
        codigo: i.produto.codigo,
        nome: i.produto.nome,
        categoria: i.produto.categoria,
        unidadeMedida: i.produto.unidadeMedida,
      },
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      subtotal: Number(i.subtotal),
    })),
  };
}

/** Garante que o usuário é um vendedor ativo; devolve o registro Vendedor. */
async function exigirVendedor(
  req: Request,
  res: Response,
): Promise<Vendedor | null> {
  if (req.user!.type !== 'VENDEDOR') {
    res.status(403).json({ mensagem: 'Apenas vendedores podem criar pedidos' });
    return null;
  }
  const vendedor = await service.getVendedorByUsuario(req.user!.sub);
  if (!vendedor || !vendedor.ativo) {
    res.status(403).json({ mensagem: 'Vendedor não encontrado ou inativo' });
    return null;
  }
  return vendedor;
}

/** Carrega o pedido garantindo que pertence ao vendedor e é rascunho. */
async function carregarRascunho(
  pedidoId: string,
  vendedorId: string,
  res: Response,
): Promise<PedidoComItens | null> {
  const pedido = await service.getPedidoDoVendedor(pedidoId, vendedorId);
  if (!pedido) {
    res.status(404).json({ mensagem: 'Pedido não encontrado' });
    return null;
  }
  if (pedido.status !== 'RASCUNHO') {
    res.status(409).json({ mensagem: 'O pedido não é mais um rascunho' });
    return null;
  }
  return pedido;
}

async function responderPedidoAtualizado(
  pedidoId: string,
  vendedorId: string,
  res: Response,
): Promise<void> {
  await service.recomputarTotais(pedidoId);
  const atualizado = await service.getPedidoDoVendedor(pedidoId, vendedorId);
  res.json({ pedido: atualizado ? serialize(atualizado) : null });
}

export async function obterRascunho(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const rascunho = await service.getRascunhoAtual(vendedor.id);
  res.json({ pedido: rascunho ? serialize(rascunho) : null });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;

  const parsed = z
    .object({ cliente_id: z.string().uuid() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'cliente_id é obrigatório' });
    return;
  }

  // Um rascunho por vendedor (RN-04).
  const existente = await service.getRascunhoAtual(vendedor.id);
  if (existente) {
    res.status(409).json({
      mensagem: 'Já existe um rascunho em andamento',
      rascunho: serialize(existente),
    });
    return;
  }

  const cliente = await service.getCliente(parsed.data.cliente_id);
  if (!cliente || !cliente.ativo) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  if (cliente.localId !== vendedor.localId) {
    res.status(403).json({ mensagem: 'Cliente pertence a outro local' });
    return;
  }

  try {
    const pedido = await service.criarRascunho(
      vendedor.id,
      vendedor.localId,
      cliente.id,
    );
    res.status(201).json({ pedido: serialize(pedido) });
  } catch (e) {
    // Corrida: a restrição única do banco barrou um segundo rascunho.
    if (isUniqueConstraintError(e)) {
      const atual = await service.getRascunhoAtual(vendedor.id);
      res.status(409).json({
        mensagem: 'Já existe um rascunho em andamento',
        rascunho: atual ? serialize(atual) : null,
      });
      return;
    }
    throw e;
  }
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;
  await service.excluirPedido(pedido.id);
  res.json({ mensagem: 'Rascunho descartado' });
}

export async function adicionarItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({
      produto_id: z.string().uuid(),
      quantidade: z.number().positive(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'produto_id e quantidade (> 0) são obrigatórios' });
    return;
  }

  const noMix = await service.produtoNoMix(pedido.clienteId, parsed.data.produto_id);
  if (!noMix) {
    res.status(400).json({ mensagem: 'Produto não está no mix deste cliente' });
    return;
  }
  const produto = await service.getProduto(parsed.data.produto_id);
  if (!produto || !produto.ativo) {
    res.status(404).json({ mensagem: 'Produto não encontrado' });
    return;
  }

  await service.definirItem(pedido.id, produto, parsed.data.quantidade);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function atualizarItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({ quantidade: z.number().positive() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'quantidade (> 0) é obrigatória' });
    return;
  }

  const item = await service.getItem(req.params.itemId);
  if (!item || item.pedidoId !== pedido.id) {
    res.status(404).json({ mensagem: 'Item não encontrado no pedido' });
    return;
  }

  await service.atualizarQuantidadeItem(item, parsed.data.quantidade);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function removerItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const item = await service.getItem(req.params.itemId);
  if (!item || item.pedidoId !== pedido.id) {
    res.status(404).json({ mensagem: 'Item não encontrado no pedido' });
    return;
  }

  await service.excluirItem(item.id);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function atualizarObservacoes(
  req: Request,
  res: Response,
): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({ observacoes: z.string().max(1000) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'observacoes inválidas' });
    return;
  }

  await service.atualizarObservacoes(pedido.id, parsed.data.observacoes);
  const atualizado = await service.getPedidoDoVendedor(pedido.id, vendedor.id);
  res.json({ pedido: atualizado ? serialize(atualizado) : null });
}
