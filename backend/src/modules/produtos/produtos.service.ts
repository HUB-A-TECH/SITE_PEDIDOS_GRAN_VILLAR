import { prisma } from '../../lib/prisma';
import { Categoria, type Produto } from '@prisma/client';

export function listCategoriaValues(): string[] {
  return Object.values(Categoria);
}

export function getClienteById(clienteId: string) {
  return prisma.cliente.findUnique({ where: { id: clienteId } });
}

/** Produtos ativos do mix daquele cliente (RN-10), opcionalmente por categoria. */
export async function listMixDoCliente(
  clienteId: string,
  categoria?: Categoria,
): Promise<Produto[]> {
  const itens = await prisma.clienteProduto.findMany({
    where: {
      clienteId,
      ativo: true,
      produto: { ativo: true, ...(categoria ? { categoria } : {}) },
    },
    include: { produto: true },
    orderBy: { produto: { nome: 'asc' } },
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
    orderBy: { produto: { nome: 'asc' } },
  });
  return itens.map((cp) => cp.produto);
}

// ---- Admin (catálogo completo) ----

export function listCatalogo(filtros: {
  categoria?: Categoria;
  ativo?: boolean;
}): Promise<Produto[]> {
  return prisma.produto.findMany({
    where: {
      ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
    },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
  });
}

export function criarProduto(data: {
  codigo: string;
  nome: string;
  categoria: Categoria;
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
    categoria: Categoria;
    descricao: string;
    preco: number;
    unidadeMedida: string;
    ativo: boolean;
  }>,
): Promise<Produto> {
  return prisma.produto.update({ where: { id }, data });
}
