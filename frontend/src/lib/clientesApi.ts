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

// ---- Anotações de visita (perfil do cliente) ----

export interface Anotacao {
  id: string;
  texto: string;
  fixada: boolean;
  criadoEm: string;
  editadoEm: string | null;
  autor: string;
  podeEditar: boolean;
  podeApagar: boolean;
}

export async function listarAnotacoes(clienteId: string): Promise<Anotacao[]> {
  const res = await api.get<{ anotacoes: Anotacao[] }>(`/clientes/${clienteId}/anotacoes`);
  return res.data.anotacoes;
}

export async function criarAnotacao(
  clienteId: string,
  data: { texto: string; fixada: boolean },
): Promise<Anotacao> {
  const res = await api.post<Anotacao>(`/clientes/${clienteId}/anotacoes`, data);
  return res.data;
}

export async function atualizarAnotacao(
  clienteId: string,
  id: string,
  data: { texto?: string; fixada?: boolean },
): Promise<Anotacao> {
  const res = await api.put<Anotacao>(`/clientes/${clienteId}/anotacoes/${id}`, data);
  return res.data;
}

export async function apagarAnotacao(clienteId: string, id: string): Promise<void> {
  await api.delete(`/clientes/${clienteId}/anotacoes/${id}`);
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

/**
 * "Adicionar/remover todos" no mix. categoria: undefined = todas; null = sem
 * categoria; id = aquela categoria.
 */
const paramCategoria = (categoria: string | null | undefined) =>
  categoria === undefined ? {} : { categoria: categoria ?? 'sem' };

export async function contarParaTodos(
  clienteId: string,
  categoria: string | null | undefined,
): Promise<{ faltam: number; noMix: number }> {
  const res = await api.get<{ faltam: number; noMix: number }>(
    `/admin/clientes/${clienteId}/produtos/todos`,
    { params: paramCategoria(categoria) },
  );
  return res.data;
}

export async function adicionarTodosAoMix(
  clienteId: string,
  categoria: string | null | undefined,
): Promise<number> {
  const res = await api.post<{ adicionados: number }>(
    `/admin/clientes/${clienteId}/produtos/todos`,
    paramCategoria(categoria),
  );
  return res.data.adicionados;
}

export async function removerTodosDoMix(
  clienteId: string,
  categoria: string | null | undefined,
): Promise<number> {
  const res = await api.delete<{ removidos: number }>(
    `/admin/clientes/${clienteId}/produtos/todos`,
    { data: paramCategoria(categoria) },
  );
  return res.data.removidos;
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
