import { api } from './api';
import type { Cliente, Local, MixProduto } from './types';

export interface ClienteInput {
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  localId: string;
}

// Vendedor: clientes do próprio local.
export async function listar(): Promise<Cliente[]> {
  const res = await api.get<{ clientes: Cliente[] }>('/clientes');
  return res.data.clientes;
}

// ---- Admin ----

export async function adminListar(localId: string): Promise<Cliente[]> {
  const res = await api.get<{ clientes: Cliente[] }>('/admin/clientes', {
    params: { local_id: localId },
  });
  return res.data.clientes;
}

export async function adminCriar(data: ClienteInput): Promise<Cliente> {
  const res = await api.post<Cliente>('/admin/clientes', data);
  return res.data;
}

export async function adminAtualizar(
  id: string,
  data: Partial<ClienteInput> & { ativo?: boolean },
): Promise<Cliente> {
  const res = await api.put<Cliente>(`/admin/clientes/${id}`, data);
  return res.data;
}

// ---- Mix do cliente (admin) ----

export async function listarMix(clienteId: string): Promise<MixProduto[]> {
  const res = await api.get<{ produtos: MixProduto[] }>(
    `/admin/clientes/${clienteId}/produtos`,
  );
  return res.data.produtos;
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
