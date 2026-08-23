import { api } from './api';
import type { TabelaDetalhe, TabelaPreco } from './types';

/** Só as ativas — é o que aparece para escolher no cadastro do cliente. */
export async function listar(): Promise<TabelaPreco[]> {
  const res = await api.get<{ tabelas: TabelaPreco[] }>('/admin/tabelas');
  return res.data.tabelas;
}

/** Todas, inclusive as desativadas (tela de gestão das tabelas). */
export async function listarTodas(): Promise<TabelaPreco[]> {
  const res = await api.get<{ tabelas: TabelaPreco[] }>('/admin/tabelas', {
    params: { ativas: 'false' },
  });
  return res.data.tabelas;
}

export async function detalhe(id: string): Promise<TabelaDetalhe> {
  const res = await api.get<TabelaDetalhe>(`/admin/tabelas/${id}`);
  return res.data;
}

export async function criar(data: {
  nome: string;
  descricao?: string;
  duplicarDe?: string;
}): Promise<TabelaPreco> {
  const res = await api.post<TabelaPreco>('/admin/tabelas', data);
  return res.data;
}

export async function atualizar(
  id: string,
  data: Partial<{ nome: string; descricao: string; ativo: boolean }>,
): Promise<TabelaPreco> {
  const res = await api.put<TabelaPreco>(`/admin/tabelas/${id}`, data);
  return res.data;
}

export async function definirPreco(
  tabelaId: string,
  produtoId: string,
  preco: number,
): Promise<void> {
  await api.put(`/admin/tabelas/${tabelaId}/produtos/${produtoId}`, { preco });
}
