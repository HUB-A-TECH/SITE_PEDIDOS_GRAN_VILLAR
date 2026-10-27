import { prisma } from '../../lib/prisma';

const comTotal = { _count: { select: { produtos: true } } } as const;

/** Categorias na ordem do admin (é a ordem dos produtos no pedido). */
export function listar() {
  return prisma.categoria.findMany({
    include: comTotal,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
}

/** Cria a categoria no fim da fila. */
export async function criar(nome: string) {
  const ultima = await prisma.categoria.aggregate({ _max: { ordem: true } });
  return prisma.categoria.create({
    data: { nome, ordem: (ultima._max.ordem ?? -1) + 1 },
    include: comTotal,
  });
}

export function renomear(id: string, nome: string) {
  return prisma.categoria.update({ where: { id }, data: { nome }, include: comTotal });
}

/** Grava a ordem: a posição de cada id na lista vira a ordem. */
export async function reordenar(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, ordem) => prisma.categoria.updateMany({ where: { id }, data: { ordem } })),
  );
}

/**
 * Exclui a categoria. Os produtos dela vão para `destinoId` ou, se null, ficam
 * sem categoria (aparecem no fim da lista).
 */
export async function excluir(id: string, destinoId: string | null) {
  await prisma.$transaction([
    prisma.produto.updateMany({ where: { categoriaId: id }, data: { categoriaId: destinoId } }),
    prisma.categoria.delete({ where: { id } }),
  ]);
}

export function existe(id: string) {
  return prisma.categoria.findUnique({ where: { id }, select: { id: true } });
}
