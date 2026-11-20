import { prisma } from '../../lib/prisma';
import type { Produto } from '@prisma/client';

// Ordem do pedido: categoria (na ordem do admin; sem categoria vai pro fim) e,
// dentro dela, nome em ordem alfabética.
const ordemCatalogo = [{ categoria: { ordem: 'asc' } }, { nome: 'asc' }] as const;
const ordemMix = [
  { produto: { categoria: { ordem: 'asc' } } },
  { produto: { nome: 'asc' } },
] as const;

export function getClienteById(clienteId: string) {
  return prisma.cliente.findUnique({ where: { id: clienteId } });
}

/** Produtos ativos do mix daquele cliente (RN-10), opcionalmente por categoria. */
export async function listMixDoCliente(
  clienteId: string,
  categoriaId?: string,
): Promise<Produto[]> {
  const itens = await prisma.clienteProduto.findMany({
    where: {
      clienteId,
      ativo: true,
      produto: { ativo: true, ...(categoriaId ? { categoriaId } : {}) },
    },
    relationLoadStrategy: 'join',
    include: { produto: true },
    orderBy: [...ordemMix],
  });
  return itens.map((cp) => cp.produto);
}

export const TABELA_PADRAO_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Catálogo completo de produtos ativos com o preço da Tabela Padrão
 * (cai no preço do catálogo caso algum item não tenha linha na tabela).
 */
export async function listCatalogoPadrao() {
  const tabela = await prisma.tabelaPreco.findFirst({
    where: {
      OR: [
        { id: TABELA_PADRAO_ID },
        { nome: { equals: 'Tabela Padrão', mode: 'insensitive' } },
      ],
    },
    select: { id: true, nome: true },
  });
  const tabelaId = tabela?.id ?? TABELA_PADRAO_ID;
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    include: { tabelaPrecoItens: { where: { tabelaId }, select: { preco: true } } },
    orderBy: [...ordemCatalogo],
  });
  return { tabelaNome: tabela?.nome ?? 'Tabela Padrão', produtos };
}

// ---- Admin (catálogo completo) ----

export function listCatalogo(filtros: {
  categoriaId?: string;
  ativo?: boolean;
}): Promise<Produto[]> {
  return prisma.produto.findMany({
    where: {
      ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
    },
    orderBy: [...ordemCatalogo],
  });
}

export function criarProduto(data: {
  codigo: string;
  nome: string;
  categoriaId: string | null;
  descricao?: string;
  preco: number;
  unidadeMedida: string;
}): Promise<Produto> {
  return prisma.produto.create({ data });
}

export function atualizarProduto(
  id: string,
  data: Partial<{
    codigo: string;
    nome: string;
    categoriaId: string | null;
    descricao: string;
    preco: number;
    unidadeMedida: string;
    ativo: boolean;
  }>,
): Promise<Produto> {
  return prisma.produto.update({ where: { id }, data });
}

/**
 * Coloca o produto no mix dos clientes escolhidos (ou de todos os ativos).
 * Quem já tinha o produto desativado no mix volta a tê-lo. Devolve quantos
 * clientes receberam.
 */
export async function enviarParaClientes(
  produtoId: string,
  alvo: { todos: true } | { clienteIds: string[] },
): Promise<number> {
  const clienteIds =
    'todos' in alvo
      ? (await prisma.cliente.findMany({ where: { ativo: true }, select: { id: true } })).map(
          (c) => c.id,
        )
      : alvo.clienteIds;
  if (clienteIds.length === 0) return 0;
  await prisma.$transaction([
    prisma.clienteProduto.updateMany({
      where: { produtoId, clienteId: { in: clienteIds } },
      data: { ativo: true },
    }),
    prisma.clienteProduto.createMany({
      data: clienteIds.map((clienteId) => ({ clienteId, produtoId })),
      skipDuplicates: true,
    }),
  ]);
  return clienteIds.length;
}
