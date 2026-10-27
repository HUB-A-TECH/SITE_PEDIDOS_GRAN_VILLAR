import { prisma } from '../../lib/prisma';
import type { Prisma, TabelaPreco } from '@prisma/client';

export function listar(apenasAtivas: boolean) {
  return prisma.tabelaPreco.findMany({
    where: apenasAtivas ? { ativo: true } : {},
    include: { _count: { select: { clientes: true } } },
    orderBy: { nome: 'asc' },
  });
}

export function getById(id: string): Promise<TabelaPreco | null> {
  return prisma.tabelaPreco.findUnique({ where: { id } });
}

export function criar(data: {
  nome: string;
  descricao?: string;
}): Promise<TabelaPreco> {
  return prisma.tabelaPreco.create({ data });
}

/**
 * Cria uma tabela nova já com todos os preços de outra — o caminho normal para
 * abrir uma tabela (duplicar a Padrão e mexer só no que muda).
 */
export function duplicar(
  origemId: string,
  data: { nome: string; descricao?: string },
): Promise<TabelaPreco> {
  return prisma.$transaction(async (tx) => {
    const nova = await tx.tabelaPreco.create({ data });
    const itens = await tx.tabelaPrecoItem.findMany({
      where: { tabelaId: origemId },
      select: { produtoId: true, preco: true },
    });
    if (itens.length > 0) {
      await tx.tabelaPrecoItem.createMany({
        data: itens.map((i) => ({
          tabelaId: nova.id,
          produtoId: i.produtoId,
          preco: i.preco,
        })),
      });
    }
    return nova;
  });
}

export function atualizar(
  id: string,
  data: Partial<{ nome: string; descricao: string; ativo: boolean }>,
): Promise<TabelaPreco> {
  return prisma.tabelaPreco.update({ where: { id }, data });
}

/** Catálogo completo com o preço daquela tabela (ou o do catálogo, se faltar). */
export function listarProdutosDaTabela(tabelaId: string) {
  return prisma.produto.findMany({
    where: { ativo: true },
    include: { tabelaPrecoItens: { where: { tabelaId }, select: { preco: true } } },
    orderBy: [{ categoria: { ordem: 'asc' } }, { nome: 'asc' }],
  });
}

export function definirPreco(
  tabelaId: string,
  produtoId: string,
  preco: Prisma.Decimal | number,
) {
  return prisma.tabelaPrecoItem.upsert({
    where: { tabelaId_produtoId: { tabelaId, produtoId } },
    create: { tabelaId, produtoId, preco },
    update: { preco },
  });
}

/** Clientes que usam a tabela — mostrado antes de confirmar um reajuste. */
export function clientesDaTabela(tabelaId: string) {
  return prisma.cliente.findMany({
    where: { tabelaPrecoId: tabelaId },
    select: { id: true, codigo: true, nome: true, nomeFantasia: true, ativo: true },
    orderBy: { nome: 'asc' },
  });
}

export function produtoExiste(id: string) {
  return prisma.produto.findUnique({ where: { id }, select: { id: true } });
}
