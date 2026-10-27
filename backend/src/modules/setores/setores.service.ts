import { prisma } from '../../lib/prisma';

const setorInclude = {
  vendedores: {
    select: { vendedor: { select: { id: true, nomeCompleto: true, ativo: true } } },
    orderBy: { vendedor: { nomeCompleto: 'asc' } },
  },
  _count: { select: { clientes: true } },
} as const;

export function listar(localId: string) {
  return prisma.setor.findMany({
    where: { localId },
    include: setorInclude,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
}

export function getById(id: string) {
  return prisma.setor.findUnique({ where: { id }, include: setorInclude });
}

/** Cria o setor no fim da fila de cartões da filial. */
export async function criar(data: { nome: string; localId: string; cor: string }) {
  const ultimo = await prisma.setor.aggregate({
    where: { localId: data.localId },
    _max: { ordem: true },
  });
  return prisma.setor.create({
    data: { ...data, ordem: (ultimo._max.ordem ?? -1) + 1 },
    include: setorInclude,
  });
}

export function atualizar(id: string, data: { nome?: string; cor?: string }) {
  return prisma.setor.update({ where: { id }, data, include: setorInclude });
}

/** Grava a ordem dos cartões: a posição de cada id na lista vira a ordem. */
export async function reordenar(localId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, ordem) =>
      prisma.setor.updateMany({ where: { id, localId }, data: { ordem } }),
    ),
  );
}

/** Exclui o setor. Os clientes dele ficam sem setor (FK com SET NULL). */
export function excluir(id: string) {
  return prisma.setor.delete({ where: { id } });
}

/** Vendedores da filial que podem entrar no setor (ativos). */
export function vendedoresDaFilial(localId: string) {
  return prisma.vendedor.findMany({
    where: { localId, ativo: true },
    select: { id: true, nomeCompleto: true, ativo: true },
    orderBy: { nomeCompleto: 'asc' },
  });
}

/** Todos os clientes da filial, com o setor atual de cada um. */
export function clientesDaFilial(localId: string) {
  return prisma.cliente.findMany({
    where: { localId },
    select: {
      id: true,
      codigo: true,
      nome: true,
      nomeFantasia: true,
      bairro: true,
      cidade: true,
      ativo: true,
      setor: { select: { id: true, nome: true } },
    },
    orderBy: { nome: 'asc' },
  });
}

export function getVendedor(id: string) {
  return prisma.vendedor.findUnique({ where: { id }, select: { id: true, localId: true } });
}

export function getCliente(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    select: { id: true, localId: true, setorId: true },
  });
}

export function adicionarVendedor(setorId: string, vendedorId: string) {
  return prisma.setorVendedor.upsert({
    where: { setorId_vendedorId: { setorId, vendedorId } },
    create: { setorId, vendedorId },
    update: {},
  });
}

export function removerVendedor(setorId: string, vendedorId: string) {
  return prisma.setorVendedor.deleteMany({ where: { setorId, vendedorId } });
}

/** Coloca o cliente no setor (se estava em outro, sai de lá: é um setor só). */
export function colocarCliente(setorId: string, clienteId: string) {
  return prisma.cliente.update({ where: { id: clienteId }, data: { setorId } });
}

/** Tira o cliente do setor — só se ele estiver mesmo neste setor. */
export function tirarCliente(setorId: string, clienteId: string) {
  return prisma.cliente.updateMany({
    where: { id: clienteId, setorId },
    data: { setorId: null },
  });
}
