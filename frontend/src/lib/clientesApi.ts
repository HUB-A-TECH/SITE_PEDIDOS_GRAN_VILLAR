import { api } from './api';
import type { Cliente, ClienteCompleto, Local, MixProduto, Produto } from './types';

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

// ---- Perfil do cliente (vendedor do setor e admin) ----

export interface PerfilCliente {
  cliente: Cliente & { setor: { id: string; nome: string } | null };
  resumo: {
    totalPedidos: number;
    pedidos12Meses: number;
    ultimaCompra: string | null;
    /** Intervalo médio entre compras nos últimos 12 meses (null: menos de 2). */
    intervaloMedioDias: number | null;
    ticketMedio: number | null;
    maisComprados: {
      produtoId: string;
      nome: string;
      unidadeMedida: string;
      /** Em quantos pedidos (12 meses) o produto aparece. */
      pedidos: number;
      mediaPorPedido: number;
    }[];
  };
  ultimosPedidos: {
    pedidoId: string;
    numeroPedido: string | null;
    data: string;
    total: number;
    itensCount: number;
    alteradoPeloComercial: boolean;
  }[];
  /** Só para vendedor: pedido salvo (não enviado) dele para este cliente. */
  pedidoSalvoId: string | null;
}

export async function perfil(clienteId: string): Promise<PerfilCliente> {
  const res = await api.get<PerfilCliente>(`/clientes/${clienteId}/perfil`);
  return res.data;
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

// ---- Mix pelo vendedor (tela de pedido) e histórico do mix ----

/** Produtos ativos que o cliente não tem no mix (com o preço da tabela dele). */
export async function foraDoMix(clienteId: string): Promise<Produto[]> {
  const res = await api.get<{ produtos: Produto[] }>(`/clientes/${clienteId}/fora-do-mix`);
  return res.data.produtos;
}

export async function vendedorAdicionarAoMix(clienteId: string, produtoId: string): Promise<void> {
  await api.post(`/clientes/${clienteId}/mix`, { produto_id: produtoId });
}

export async function vendedorRemoverDoMix(clienteId: string, produtoId: string): Promise<void> {
  await api.delete(`/clientes/${clienteId}/mix/${produtoId}`);
}

export type AcaoMix = 'ADICIONADO_NO_PEDIDO' | 'ADICIONADO_AO_MIX' | 'REMOVIDO_DO_MIX';

export interface AlteracaoMix {
  id: string;
  acao: AcaoMix;
  produto: string;
  /** Nome de quem fez (null se o usuário foi apagado). */
  quem: string | null;
  pedidoId: string | null;
  data: string;
}

export async function historicoMix(clienteId: string): Promise<AlteracaoMix[]> {
  const res = await api.get<{ alteracoes: AlteracaoMix[] }>(`/clientes/${clienteId}/historico-mix`);
  return res.data.alteracoes;
}
