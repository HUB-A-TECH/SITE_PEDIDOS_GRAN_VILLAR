import { prisma } from '../../lib/prisma';

const autorSelect = {
  select: { id: true, username: true, type: true, vendedor: { select: { nomeCompleto: true } } },
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

/** Mudar o texto marca "editado" e reinicia a leitura; só desafixar não altera visto. */
export function atualizar(id: string, data: { texto?: string; fixada?: boolean }) {
  const reiniciarLeitura = data.texto !== undefined || data.fixada === true;
  return prisma.anotacaoCliente.update({
    where: { id },
    data: {
      ...data,
      ...(data.texto !== undefined ? { editadoEm: new Date() } : {}),
      ...(reiniciarLeitura ? { vistoPeloVendedorEm: null } : {}),
    },
    include: { autor: autorSelect },
  });
}

export function marcarFixadasComoVistas(clienteId: string) {
  return prisma.anotacaoCliente.updateMany({
    where: { clienteId, fixada: true, vistoPeloVendedorEm: null },
    data: { vistoPeloVendedorEm: new Date() },
  });
}

export function excluir(id: string) {
  return prisma.anotacaoCliente.delete({ where: { id } });
}
