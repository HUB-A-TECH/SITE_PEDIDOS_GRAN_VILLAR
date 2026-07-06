import { prisma } from '../../lib/prisma';
import type { Cliente, ClienteProduto, Produto } from '@prisma/client';

export function listByLocal(
  localId: string,
  apenasAtivos: boolean,
): Promise<Cliente[]> {
  return prisma.cliente.findMany({
    where: { localId, ...(apenasAtivos ? { ativo: true } : {}) },
    orderBy: { nome: 'asc' },
  });
}

export function getById(id: string): Promise<Cliente | null> {
  return prisma.cliente.findUnique({ where: { id } });
}

export function criar(data: {
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  localId: string;
}): Promise<Cliente> {
  return prisma.cliente.create({ data });
}

export function atualizar(
  id: string,
  data: Partial<{
    codigo: string;
    nome: string;
    nomeFantasia: string;
    cnpj: string;
    email: string;
    telefone: string;
    endereco: string;
    localId: string;
    ativo: boolean;
  }>,
): Promise<Cliente> {
  return prisma.cliente.update({ where: { id }, data });
}

// ---- Mix do cliente ----

export function listMix(
  clienteId: string,
): Promise<(ClienteProduto & { produto: Produto })[]> {
  return prisma.clienteProduto.findMany({
    where: { clienteId, ativo: true },
    include: { produto: true },
    orderBy: { produto: { nome: 'asc' } },
  });
}

export function addAoMix(
  clienteId: string,
  produtoId: string,
): Promise<ClienteProduto> {
  return prisma.clienteProduto.upsert({
    where: { clienteId_produtoId: { clienteId, produtoId } },
    create: { clienteId, produtoId, ativo: true },
    update: { ativo: true },
  });
}

export async function removerDoMix(
  clienteId: string,
  produtoId: string,
): Promise<number> {
  const r = await prisma.clienteProduto.updateMany({
    where: { clienteId, produtoId },
    data: { ativo: false },
  });
  return r.count;
}

export function produtoExiste(id: string): Promise<Produto | null> {
  return prisma.produto.findUnique({ where: { id } });
}
