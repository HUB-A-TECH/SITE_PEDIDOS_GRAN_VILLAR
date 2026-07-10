import { api } from './api';
import type { Categoria } from './types';

export type Periodo = 3 | 6 | 12;

export interface ProdutoHistorico {
  produtoId: string;
  codigo: string;
  nome: string;
  categoria: Categoria;
  unidadeMedida: string;
  quantidadeUltima: number;
  quantidadeMedia: number;
  quantidadeTotal: number;
  numeroCompras: number;
}

export interface ItemHistorico {
  codigo: string;
  nome: string;
  quantidade: number;
  unidadeMedida: string;
}

export interface PedidoHistorico {
  pedidoId: string;
  numeroPedido: string | null;
  data: string;
  total: number;
  itens: ItemHistorico[];
}

export interface MeuPedido {
  pedidoId: string;
  numeroPedido: string | null;
  cliente: { id: string; codigo: string; nome: string };
  data: string;
  total: number;
  status: 'CONFIRMADO' | 'CANCELADO';
  itensCount: number;
}

export async function produtosHistorico(
  clienteId: string,
  periodo: Periodo = 6,
): Promise<ProdutoHistorico[]> {
  const res = await api.get<{ produtos: ProdutoHistorico[] }>(
    `/clientes/${clienteId}/produtos-historico`,
    { params: { periodo } },
  );
  return res.data.produtos;
}

export async function historicoCliente(
  clienteId: string,
  periodo: Periodo = 6,
): Promise<PedidoHistorico[]> {
  const res = await api.get<{ historico: PedidoHistorico[] }>(
    `/clientes/${clienteId}/historico`,
    { params: { periodo } },
  );
  return res.data.historico;
}

export interface ItemHistoricoProduto {
  data: string;
  quantidade: number;
}

/** Histórico por produto do cliente (últimos 12 meses), indexado por produtoId. */
export async function historicoItens(
  clienteId: string,
): Promise<Record<string, ItemHistoricoProduto[]>> {
  const res = await api.get<{ historico: Record<string, ItemHistoricoProduto[]> }>(
    `/clientes/${clienteId}/historico-itens`,
  );
  return res.data.historico;
}

export async function meuHistorico(periodo: Periodo = 6): Promise<MeuPedido[]> {
  const res = await api.get<{ pedidos: MeuPedido[] }>('/pedidos/historico', {
    params: { periodo },
  });
  return res.data.pedidos;
}
