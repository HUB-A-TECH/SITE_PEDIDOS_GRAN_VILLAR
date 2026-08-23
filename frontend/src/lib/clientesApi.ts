import { api } from './api';
import type {
  Cliente,
  ClienteCompleto,
  Local,
  MixProduto,
  VendedorOpcao,
} from './types';

export interface ClienteInput {
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  nomeComprador?: string;
  telefoneComprador?: string;
  localId: string;
  tabelaPrecoId?: string;
  /** Carteira: vendedores responsáveis por este cliente. */
  vendedorIds?: string[];
}

// Vendedor: clientes do próprio local.
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

/** Vendedores ativos da filial — opções da carteira no cadastro do cliente. */
export async function adminListarVendedores(
  localId: string,
): Promise<VendedorOpcao[]> {
  const res = await api.get<{ vendedores: VendedorOpcao[] }>(
    '/admin/clientes/vendedores',
    { params: { local_id: localId } },
  );
  return res.data.vendedores;
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
