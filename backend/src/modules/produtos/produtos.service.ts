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
    include: { produto: true },
    orderBy: [...ordemMix],
  });
  return itens.map((cp) => cp.produto);
}

/** Busca por nome/código restrita ao mix do cliente (RN-11). */
export async function buscarNoMix(
  clienteId: string,
  termo: string,
): Promise<Produto[]> {
  const itens = await prisma.clienteProduto.findMany({
    where: {
      clienteId,
      ativo: true,
      produto: {
        ativo: true,
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { codigo: { contains: termo, mode: 'insensitive' } },
        ],
      },
    },
    include: { produto: true },
    orderBy: [...ordemMix],
  });
  return itens.map((cp) => cp.produto);
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
