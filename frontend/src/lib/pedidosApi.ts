import { api } from './api';
import { nomeCliente } from './formatar';
import type { Categoria, Limite } from './types';
import type { Revisao } from './statusPedido';

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
  numeroPedido: string | null;
  clienteId: string;
  status: 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO';
  observacoes: string | null;
  subtotal: number;
  total: number;
  cliente: { id: string; codigo: string; nome: string; nomeFantasia?: string | null };
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
  /** Produto fora do mix, só para este pedido (o mix não muda). */
  soNestePedido = false,
): Promise<Pedido> {
  const res = await api.post<{ pedido: Pedido }>(`/pedidos/${pedidoId}/itens`, {
    produto_id: produtoId,
    quantidade,
    ...(soNestePedido ? { so_neste_pedido: true } : {}),
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

/** URL de download do Excel (mesma origem via proxy; cookie enviado). */
export function excelHref(pedidoId: string): string {
  return `/api/pedidos/${pedidoId}/excel`;
}

/** URL de download do PDF (documento para entregar ao cliente). */
export function pdfHref(pedidoId: string): string {
  return `/api/pedidos/${pedidoId}/pdf`;
}

/** Busca o Excel como Blob em memória (para compartilhamento direto via Web Share API). */
export async function baixarExcelBlob(pedidoId: string): Promise<Blob> {
  const res = await api.get<Blob>(`/pedidos/${pedidoId}/excel`, {
    responseType: 'blob',
  });
  return res.data;
}

/** Busca o PDF como Blob em memória (para compartilhamento direto no celular via Web Share API). */
export async function baixarPdfBlob(pedidoId: string): Promise<Blob> {
  const res = await api.get<Blob>(`/pedidos/${pedidoId}/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function limparParteNome(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function nomeArquivoExport(
  cliente: { codigo: string; nome: string; nomeFantasia?: string | null },
  numeroPedido: string | null,
  pedidoId: string,
  ext: 'pdf' | 'xlsx',
): string {
  const codCliente = limparParteNome(cliente.codigo);
  const fantasia = limparParteNome(cliente.nomeFantasia?.trim() || cliente.nome);
  const codPedido = limparParteNome(numeroPedido ?? pedidoId.slice(0, 8));
  return `${['Gran_Villar', codCliente, fantasia, codPedido].filter(Boolean).join('_')}.${ext}`;
}

/** Nome padrão do arquivo PDF: Gran_Villar_<codigoCliente>_<nomeFantasia>_<codigoPedido>.pdf */
export function nomeArquivoPdf(
  cliente: { codigo: string; nome: string; nomeFantasia?: string | null },
  numeroPedido: string | null,
  pedidoId: string,
): string {
  return nomeArquivoExport(cliente, numeroPedido, pedidoId, 'pdf');
}

/** Nome padrão do arquivo Excel: Gran_Villar_<codigoCliente>_<nomeFantasia>_<codigoPedido>.xlsx */
export function nomeArquivoExcel(
  cliente: { codigo: string; nome: string; nomeFantasia?: string | null },
  numeroPedido: string | null,
  pedidoId: string,
): string {
  return nomeArquivoExport(cliente, numeroPedido, pedidoId, 'xlsx');
}

interface DadosCompartilhamentoPedido {
  pedidoId: string;
  numeroPedido: string | null;
  cliente: { codigo: string; nome: string; nomeFantasia?: string | null };
}

async function compartilharArquivoPedido(
  dados: DadosCompartilhamentoPedido,
  ext: 'pdf' | 'xlsx',
  mime: string,
  baixarBlob: (pedidoId: string) => Promise<Blob>,
): Promise<void> {
  const blob = await baixarBlob(dados.pedidoId);
  const nomeArquivo = nomeArquivoExport(dados.cliente, dados.numeroPedido, dados.pedidoId, ext);
  const arquivo = new File([blob], nomeArquivo, { type: mime });
  const titulo = dados.numeroPedido
    ? `Pedido ${dados.numeroPedido} — ${nomeCliente(dados.cliente)}`
    : `Pedido — ${nomeCliente(dados.cliente)}`;

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({
        files: [arquivo],
        title: titulo,
      });
    } catch (e) {
      if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError') {
        return;
      }
      throw e;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Busca o PDF em memória e abre a folha nativa de compartilhamento do celular
 * (ou baixa o arquivo como fallback em navegadores sem suporte a compartilhar arquivos).
 */
export async function compartilharPdfPedido(dados: DadosCompartilhamentoPedido): Promise<void> {
  return compartilharArquivoPedido(dados, 'pdf', 'application/pdf', baixarPdfBlob);
}

/**
 * Busca o Excel em memória e abre a folha nativa de compartilhamento do celular
 * (ou baixa o arquivo como fallback em navegadores sem suporte a compartilhar arquivos).
 */
export async function compartilharExcelPedido(dados: DadosCompartilhamentoPedido): Promise<void> {
  return compartilharArquivoPedido(dados, 'xlsx', XLSX_MIME, baixarExcelBlob);
}

// ---- Alterações do comercial ----

/** O que mudou num item quando o comercial confirmou com alterações. */
export interface AlteracaoItem {
  produtoId: string;
  codigo: string;
  nome: string;
  unidadeMedida: string;
  removido: boolean;
  quantidadeAntes: number;
  quantidadeDepois: number;
  precoAntes: number;
  precoDepois: number;
}

export interface AlteracaoComercial {
  id: string;
  revisadoPor: string;
  revisadoEm: string;
  alteracoes: AlteracaoItem[];
  recado?: string | null;
  encerradoEm?: string | null;
  totalAntes: number;
  totalDepois: number;
  /** O vendedor ainda não viu. */
  novo: boolean;
  vistoPeloVendedorEm?: string | null;
}

/** Quantas alterações do comercial o vendedor ainda não viu (aviso no menu). */
export async function alteracoesNaoVistas(): Promise<number> {
  const res = await api.get<{ total: number }>('/pedidos/alteracoes/nao-vistas');
  return res.data.total;
}

/** Avisos do menu do vendedor numa chamada só: pedidos a confirmar e alterações não vistas. */
export async function resumoMenu(): Promise<{ aConfirmar: number; alteracoes: number }> {
  const res = await api.get<{ aConfirmar: number; alteracoes: number }>('/pedidos/resumo-menu');
  return res.data;
}

export async function marcarAlteracoesVistas(pedidoIds: string[]): Promise<void> {
  await api.post('/pedidos/alteracoes/vistas', { pedidoIds });
}

export interface PedidoAdmin {
  pedidoId: string;
  numeroPedido: string | null;
  cliente: { id: string; codigo: string; nome: string; nomeFantasia?: string | null };
  vendedor: { id: string; nomeCompleto: string };
  data: string;
  total: number;
  status: 'CONFIRMADO' | 'CANCELADO';
  itensCount: number;
  editadoPor: { username: string } | null;
  editadoEm: string | null;
  ultimaAlteracaoPor: { username: string } | null;
  ultimaAlteracaoEm: string | null;
  revisao: Revisao;
  /** Aprovado com alterações do comercial (ainda valendo). */
  comAlteracoes: boolean;
  /** null quando não há revisão vigente; true se todas foram vistas pelo vendedor. */
  vistoPeloVendedor?: boolean | null;
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
  cliente: { id: string; codigo: string; nome: string; nomeFantasia?: string | null };
  vendedor: { id: string; nomeCompleto: string };
  editadoPor: { username: string } | null;
  editadoEm: string | null;
  ultimaAlteracaoPor: { username: string } | null;
  ultimaAlteracaoEm: string | null;
  revisao: Revisao;
  alteracoesComercial: AlteracaoComercial[];
  /** precoTabela: preço da tabela do cliente hoje (para o aviso de desconto). */
  itens: (ItemPedido & { precoTabela: number })[];
}

export async function adminObterPedido(pedidoId: string): Promise<PedidoAdminDetalhe> {
  const res = await api.get<{ pedido: PedidoAdminDetalhe }>(`/admin/pedidos/${pedidoId}`);
  return res.data.pedido;
}

/** Item na revisão: como estava ao abrir (base) e como o comercial deixou. */
export interface ItemRevisado {
  itemId: string;
  quantidadeBase: number;
  precoBase: number;
  /** 0 = remover. */
  quantidade: number;
  precoUnitario: number;
}

/**
 * "Confirmar pedido com alterações": grava tudo de uma vez. Se o vendedor
 * mexeu no pedido enquanto o comercial revisava, o servidor recusa (409).
 */
export async function adminRevisar(
  pedidoId: string,
  itens: ItemRevisado[],
  recado?: string,
): Promise<PedidoAdminDetalhe> {
  const texto = recado?.trim();
  const res = await api.post<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/revisao`,
    { itens, ...(texto ? { recado: texto } : {}) },
  );
  return res.data.pedido;
}

/** Grava ou atualiza um recado da administração para o vendedor e próximo pedido. */
export async function adminSalvarRecado(
  pedidoId: string,
  recado: string,
): Promise<PedidoAdminDetalhe> {
  const res = await api.post<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/recado`,
    { recado },
  );
  return res.data.pedido;
}

/** Encerra os avisos/alterações vigentes do pedido (ex.: situação normalizada). */
export async function adminEncerrarAviso(
  pedidoId: string,
): Promise<PedidoAdminDetalhe> {
  const res = await api.post<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/encerrar-aviso`,
    {},
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

/** Exclui/cancela um pedido enviado (admin/comercial). */
export async function adminCancelar(
  pedidoId: string,
  motivo?: string,
): Promise<PedidoAdminDetalhe> {
  const res = await api.post<{ pedido: PedidoAdminDetalhe }>(
    `/admin/pedidos/${pedidoId}/cancelar`,
    { motivo },
  );
  return res.data.pedido;
}
