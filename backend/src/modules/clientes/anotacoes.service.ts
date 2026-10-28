import { prisma } from '../../lib/prisma';

const autorSelect = {
  select: { id: true, username: true, vendedor: { select: { nomeCompleto: true } } },
} as const;

/** Anotações do cliente: fixadas primeiro, depois as mais recentes. */
export function listar(clienteId: string) {
  return prisma.anotacaoCliente.findMany({
    where: { clienteId },
    include: { autor: autorSelect },
    orderBy: [{ fixada: 'desc' }, { criadoEm: 'desc' }],
    take: 200,
  });
}

export function getById(id: string) {
  return prisma.anotacaoCliente.findUnique({ where: { id } });
}

export function criar(data: { clienteId: string; autorId: string; texto: string; fixada: boolean }) {
  return prisma.anotacaoCliente.create({ data, include: { autor: autorSelect } });
}

/** Mudar o texto marca "editado"; só fixar/desafixar não. */
export function atualizar(id: string, data: { texto?: string; fixada?: boolean }) {
  return prisma.anotacaoCliente.update({
    where: { id },
    data: { ...data, ...(data.texto !== undefined ? { editadoEm: new Date() } : {}) },
    include: { autor: autorSelect },
  });
}

export function excluir(id: string) {
  return prisma.anotacaoCliente.delete({ where: { id } });
}
