import { api } from './api';
import type { Categoria, Produto } from './types';

export interface ProdutoInput {
  codigo: string;
  nome: string;
  categoria: Categoria;
  descricao?: string;
  preco: number;
  unidadeMedida: string;
}

export async function listarPorMix(
  clienteId: string,
  categoria?: Categoria,
): Promise<Produto[]> {
  const res = await api.get<{ produtos: Produto[] }>('/produtos', {
    params: { cliente_id: clienteId, categoria },
  });
  return res.data.produtos;
}

export async function buscarNoMix(
  clienteId: string,
  termo: string,
): Promise<Produto[]> {
  const res = await api.get<{ produtos: Produto[] }>('/produtos/buscar', {
    params: { cliente_id: clienteId, termo },
  });
  return res.data.produtos;
}

// ---- Admin ----

export async function adminListar(
  categoria?: Categoria,
): Promise<Produto[]> {
  const res = await api.get<{ produtos: Produto[] }>('/admin/produtos', {
    params: { categoria },
  });
  return res.data.produtos;
}

export async function adminCriar(data: ProdutoInput): Promise<Produto> {
  const res = await api.post<Produto>('/admin/produtos', data);
  return res.data;
}

export async function adminAtualizar(
  id: string,
  data: Partial<ProdutoInput> & { ativo?: boolean },
): Promise<Produto> {
  const res = await api.put<Produto>(`/admin/produtos/${id}`, data);
  return res.data;
}
