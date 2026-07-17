import { prisma } from '../../lib/prisma';
import type { Cliente, ItemPedido, Produto, Vendedor } from '@prisma/client';
import { isUniqueConstraintError } from '../../utils/prisma-errors';

export function getVendedorByUsuario(usuarioId: string): Promise<Vendedor | null> {
  return prisma.vendedor.findUnique({ where: { usuarioId } });
}

const pedidoInclude = {
  cliente: { select: { id: true, codigo: true, nome: true, localId: true } },
  itens: {
    include: {
      produto: {
        select: {
          id: true,
          codigo: true,
          nome: true,
          categoria: true,
          unidadeMedida: true,
        },
      },
    },
    orderBy: { produto: { nome: 'asc' } },
  },
} as const;

export function getRascunhoAtual(vendedorId: string) {
  return prisma.pedido.findFirst({
    where: { vendedorId, status: 'RASCUNHO' },
    orderBy: { criadoEm: 'desc' },
    include: pedidoInclude,
  });
}

export function getPedidoDoVendedor(id: string, vendedorId: string) {
  return prisma.pedido.findFirst({
    where: { id, vendedorId },
    include: pedidoInclude,
  });
}

export function criarRascunho(
  vendedorId: string,
  localId: string,
  clienteId: string,
) {
  return prisma.pedido.create({
    data: { vendedorId, localId, clienteId, status: 'RASCUNHO' },
    include: pedidoInclude,
  });
}

export function excluirPedido(id: string): Promise<unknown> {
  return prisma.pedido.delete({ where: { id } });
}

export function getCliente(id: string): Promise<Cliente | null> {
  return prisma.cliente.findUnique({ where: { id } });
}

export function getProduto(id: string): Promise<Produto | null> {
  return prisma.produto.findUnique({ where: { id } });
}

export function produtoNoMix(clienteId: string, produtoId: string) {
  return prisma.clienteProduto.findFirst({
    where: { clienteId, produtoId, ativo: true },
  });
}

export function getItem(itemId: string): Promise<ItemPedido | null> {
  return prisma.itemPedido.findUnique({ where: { id: itemId } });
}

function calcularSubtotal(quantidade: number, preco: number): number {
  return Math.round(quantidade * preco * 100) / 100;
}

/** Define a quantidade de um produto no pedido (cria ou atualiza o item). */
export async function definirItem(
  pedidoId: string,
  produto: Produto,
  quantidade: number,
): Promise<void> {
  const preco = Number(produto.preco);
  const subtotal = calcularSubtotal(quantidade, preco);
  const existente = await prisma.itemPedido.findFirst({
    where: { pedidoId, produtoId: produto.id },
  });
  if (existente) {
    await prisma.itemPedido.update({
      where: { id: existente.id },
      data: { quantidade, precoUnitario: preco, subtotal },
    });
  } else {
    await prisma.itemPedido.create({
      data: { pedidoId, produtoId: produto.id, quantidade, precoUnitario: preco, subtotal },
    });
  }
}

export async function atualizarQuantidadeItem(
  item: ItemPedido,
  quantidade: number,
): Promise<void> {
  const subtotal = calcularSubtotal(quantidade, Number(item.precoUnitario));
  await prisma.itemPedido.update({
    where: { id: item.id },
    data: { quantidade, subtotal },
  });
}

export function excluirItem(itemId: string): Promise<unknown> {
  return prisma.itemPedido.delete({ where: { id: itemId } });
}

/** Recalcula subtotal/total do pedido a partir dos itens. */
export async function recomputarTotais(pedidoId: string): Promise<void> {
  const itens = await prisma.itemPedido.findMany({ where: { pedidoId } });
  const soma = itens.reduce((s, i) => s + Number(i.subtotal), 0);
  const total = Math.round(soma * 100) / 100;
  await prisma.pedido.update({
    where: { id: pedidoId },
    data: { subtotal: total, total },
  });
}

export function atualizarObservacoes(pedidoId: string, observacoes: string) {
  return prisma.pedido.update({
    where: { id: pedidoId },
    data: { observacoes },
  });
}

export function contarItens(pedidoId: string): Promise<number> {
  return prisma.itemPedido.count({ where: { pedidoId } });
}

/** Confirma o rascunho: gera número sequencial por ano e marca CONFIRMADO. */
export async function confirmarPedido(pedidoId: string): Promise<string> {
  const ano = new Date().getFullYear();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const ultimo = await tx.pedido.findFirst({
          where: { numeroPedido: { startsWith: `${ano}-` } },
          orderBy: { numeroPedido: 'desc' },
          select: { numeroPedido: true },
        });
        const seq = ultimo ? Number(ultimo.numeroPedido!.split('-')[1]) + 1 : 1;
        const numero = `${ano}-${String(seq).padStart(6, '0')}`;
        await tx.pedido.update({
          where: { id: pedidoId },
          data: {
            status: 'CONFIRMADO',
            numeroPedido: numero,
            confirmadoEm: new Date(),
          },
        });
        return numero;
      });
    } catch (e) {
      if (isUniqueConstraintError(e) && tentativa < 4) continue;
      throw e;
    }
  }
  throw new Error('Não foi possível gerar o número do pedido');
}

export function cancelarPedido(pedidoId: string, motivo: string | null) {
  return prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      status: 'CANCELADO',
      canceladoEm: new Date(),
      motivoCancelamento: motivo,
    },
  });
}

/** Pedido com todos os dados necessários para o TXT / detalhe. */
export function getPedidoCompleto(id: string) {
  return prisma.pedido.findUnique({
    where: { id },
    include: {
      local: { select: { codigo: true, nome: true } },
      vendedor: { select: { nomeCompleto: true } },
      cliente: {
        select: { codigo: true, nome: true, nomeFantasia: true, cnpj: true },
      },
      itens: { include: { produto: true }, orderBy: { produto: { nome: 'asc' } } },
    },
  });
}

export interface FiltroAdminPedidos {
  limite?: number;
  vendedorId?: string;
  clienteId?: string;
}

export function listarPedidosAdmin(filtro: FiltroAdminPedidos) {
  return prisma.pedido.findMany({
    where: {
      status: { in: ['CONFIRMADO', 'CANCELADO'] },
      ...(filtro.vendedorId ? { vendedorId: filtro.vendedorId } : {}),
      ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
    },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true } },
      vendedor: { select: { id: true, nomeCompleto: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { confirmadoEm: 'desc' },
    ...(filtro.limite ? { take: filtro.limite } : {}),
  });
}
