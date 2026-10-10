import { api } from './api';
import type { Cliente, ClienteCompleto, Local, MixProduto } from './types';

export interface ClienteInput {
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  nomeComprador?: string;
  telefoneComprador?: string;
  localId: string;
  tabelaPrecoId?: string;
  /** Setor (região); os vendedores do setor atendem o cliente. null = sem setor. */
  setorId?: string | null;
}

// Vendedor: clientes dos seus setores (cada um com o nome do setor).
export async function listar(): Promise<Cliente[]> {
  const res = await api.get<{ clientes: Cliente[] }>('/clientes');
  return res.data.clientes;
}

// ---- Admin ----

export async function adminListar(localId: string): Promise<ClienteCompleto[]> {
  const res = await api.get<{ clientes: ClienteCompleto[] }>('/admin/clientes', {
    params: { local_id: localId },
  });
  return res.data.clientes;
}

export async function adminCriar(data: ClienteInput): Promise<ClienteCompleto> {
  const res = await api.post<ClienteCompleto>('/admin/clientes', data);
  return res.data;
}

export async function adminAtualizar(
  id: string,
  data: Partial<ClienteInput> & { ativo?: boolean },
): Promise<ClienteCompleto> {
  const res = await api.put<ClienteCompleto>(`/admin/clientes/${id}`, data);
  return res.data;
}

// ---- Mix do cliente (admin) ----

export interface MixResposta {
  tabelaPreco: { id: string; nome: string } | null;
  produtos: MixProduto[];
}

export async function listarMix(clienteId: string): Promise<MixResposta> {
  const res = await api.get<MixResposta>(`/admin/clientes/${clienteId}/produtos`);
  return res.data;
}

export async function adicionarAoMix(
  clienteId: string,
  produtoId: string,
): Promise<void> {
  await api.post(`/admin/clientes/${clienteId}/produtos`, {
    produto_id: produtoId,
  });
}

export async function removerDoMix(
  clienteId: string,
  produtoId: string,
): Promise<void> {
  await api.delete(`/admin/clientes/${clienteId}/produtos/${produtoId}`);
}

// ---- Locais ----

export async function listarLocais(): Promise<Local[]> {
  const res = await api.get<{ locais: Local[] }>('/locais');
  return res.data.locais;
}

export async function atualizarLocal(
  id: string,
  data: Partial<{
    nome: string;
    telefone: string;
    endereco: string;
    responsavel: string;
  }>,
): Promise<Local> {
  const res = await api.put<Local>(`/locais/${id}`, data);
  return res.data;
}
