import axios from 'axios';
import { api } from './api';
import type { Categoria } from './types';

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

export type CriarResultado =
  | { tipo: 'criado'; pedido: Pedido }
  | { tipo: 'conflito'; rascunho: Pedido };

export async function obterRascunho(): Promise<Pedido | null> {
  const res = await api.get<{ pedido: Pedido | null }>('/pedidos/rascunho');
  return res.data.pedido;
}

export async function criar(clienteId: string): Promise<CriarResultado> {
  try {
    const res = await api.post<{ pedido: Pedido }>('/pedidos', {
      cliente_id: clienteId,
    });
    return { tipo: 'criado', pedido: res.data.pedido };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      return { tipo: 'conflito', rascunho: e.response.data.rascunho };
    }
    throw e;
  }
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
