import { api } from './api';
import type { Categoria, Limite } from './types';

export interface ItemPedido {
  id: string;
  produtoId: string;
  produto: {
    codigo: string;
    nome: string;
    categoria: Categoria;
    unidadeMedida: string;
  };
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  status: 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO';
  observacoes: string | null;
  subtotal: number;
  total: number;
  cliente: { id: string; codigo: string; nome: string };
  itens: ItemPedido[];
}

/** Obtém um pedido específico do vendedor (qualquer status). */
export async function obterPedido(pedidoId: string): Promise<Pedido | null> {
  const res = await api.get<{ pedido: Pedido | null }>(`/pedidos/${pedidoId}`);
  return res.data.pedido;
}

/**
 * Cria um pedido salvo para o cliente ou retoma o que já existir (o vendedor
 * pode ter vários pedidos salvos ao mesmo tempo, um por cliente).
 */
export async function criar(clienteId: string): Promise<Pedido> {
  const res = await api.post<{ pedido: Pedido }>('/pedidos', {
    cliente_id: clienteId,
  });
  return res.data.pedido;
}

export async function descartar(pedidoId: string): Promise<void> {
  await api.delete(`/pedidos/${pedidoId}`);
}

export async function adicionarItem(
  pedidoId: string,
  produtoId: string,
  quantidade: number,
): Promise<Pedido> {
  const res = await api.post<{ pedido: Pedido }>(`/pedidos/${pedidoId}/itens`, {
    produto_id: produtoId,
    quantidade,
  });
  return res.data.pedido;
}

export async function atualizarItem(
  pedidoId: string,
  itemId: string,
  quantidade: number,
): Promise<Pedido> {
  const res = await api.put<{ pedido: Pedido }>(
    `/pedidos/${pedidoId}/itens/${itemId}`,
    { quantidade },
  );
  return res.data.pedido;
}

export async function atualizarPrecoItem(
  pedidoId: string,
  itemId: string,
  precoUnitario: number,
): Promise<Pedido> {
  const res = await api.put<{ pedido: Pedido }>(
    `/pedidos/${pedidoId}/itens/${itemId}/preco`,
    { preco_unitario: precoUnitario },
  );
  return res.data.pedido;
}

export async function removerItem(
  pedidoId: string,
  itemId: string,
): Promise<Pedido> {
  const res = await api.delete<{ pedido: Pedido }>(
    `/pedidos/${pedidoId}/itens/${itemId}`,
  );
  return res.data.pedido;
}

export async function atualizarObservacoes(
  pedidoId: string,
  observacoes: string,
): Promise<Pedido> {
  const res = await api.put<{ pedido: Pedido }>(
    `/pedidos/${pedidoId}/observacoes`,
    { observacoes },
  );
  return res.data.pedido;
}

export async function confirmar(
  pedidoId: string,
): Promise<{ numeroPedido: string }> {
  const res = await api.post<{ numeroPedido: string }>(
    `/pedidos/${pedidoId}/confirmar`,
    {},
  );
  return res.data;
}

export async function cancelar(pedidoId: string, motivo?: string): Promise<void> {
  await api.post(`/pedidos/${pedidoId}/cancelar`, { motivo });
}

/** URL de download do TXT (mesma origem via proxy; cookie enviado). */
export function txtHref(pedidoId: string): string {
  return `/api/pedidos/${pedidoId}/txt`;
}

/** URL de download do PDF (documento para entregar ao cliente). */
export function pdfHref(pedidoId: string): string {
  return `/api/pedidos/${pedidoId}/pdf`;
}

export interface PedidoAdmin {
  pedidoId: string;
  numeroPedido: string | null;
  cliente: { id: string; codigo: string; nome: string };
  vendedor: { id: string; nomeCompleto: string };
  data: string;
  total: number;
  status: 'CONFIRMADO' | 'CANCELADO';
  itensCount: number;
  editadoPor: { username: string } | null;
  editadoEm: string | null;
  pendente: boolean;
}

export async function adminListarPedidos(
  limite: Limite = 12,
  clienteId?: string,
): Promise<PedidoAdmin[]> {
  const res = await api.get<{ pedidos: PedidoAdmin[] }>('/admin/pedidos', {
    params: {
      limite: String(limite),
      ...(clienteId ? { cliente_id: clienteId } : {}),
    },
  });
  return res.data.pedidos;
}

export interface PedidoAdminDetalhe {
  id: string;
  numeroPedido: string | null;
  status: 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO';
  observacoes: string | null;
  subtotal: number;
  total: number;
  data: string;
  cliente: { id: string; codigo: string; nome: string };
  vendedor: { id: string; nomeCompleto: string };
  editadoPor: { username: string } | null;
  editadoEm: string | null;
  itens: ItemPedido[];
}

export async function adminObterPedido(pedidoId: string): Promise<PedidoAdminDetalhe> {
  const res = await api.get<{ pedido: PedidoAdminDetalhe }>(`/admin/pedidos/${pedidoId}`);
  return res.data.pedido;
}

export async function adminAtualizarQuantidade(
  pedidoId: string,
  itemId: string,
  quantidade: number,
): Promise<PedidoAdminDetalhe> {
  const res = await api.put<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/itens/${itemId}`,
    { quantidade },
  );
  return res.data.pedido;
}

/** Aprova o pedido sem alterar nada — registra quem aprovou. */
export async function adminAprovar(pedidoId: string): Promise<PedidoAdminDetalhe> {
  const res = await api.post<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/aprovar`,
    {},
  );
  return res.data.pedido;
}

export async function adminAtualizarPreco(
  pedidoId: string,
  itemId: string,
  precoUnitario: number,
): Promise<PedidoAdminDetalhe> {
  const res = await api.put<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/itens/${itemId}/preco`,
    { preco_unitario: precoUnitario },
  );
  return res.data.pedido;
}
