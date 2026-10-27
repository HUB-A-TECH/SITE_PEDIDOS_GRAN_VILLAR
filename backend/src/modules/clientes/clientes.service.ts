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

export function listTodos(apenasAtivos: boolean): Promise<Cliente[]> {
  return prisma.cliente.findMany({
    where: apenasAtivos ? { ativo: true } : {},
    orderBy: { nome: 'asc' },
  });
}

export function getById(id: string): Promise<Cliente | null> {
  return prisma.cliente.findUnique({ where: { id } });
}

/** Cliente com o nome do setor — usado nas telas do vendedor (perfil). */
export function getByIdComSetor(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    include: { setor: { select: { id: true, nome: true, cor: true, ordem: true } } },
  });
}

export function criar(data: {
  codigo: string;
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  nomeComprador?: string;
  telefoneComprador?: string;
  localId: string;
  tabelaPrecoId?: string;
  setorId?: string | null;
}): Promise<Cliente> {
  // Cliente novo já nasce com todos os produtos ativos no mix; depois o admin
  // (ou o vendedor) tira o que aquele mercado não compra.
  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({ data });
    const produtos = await tx.produto.findMany({ where: { ativo: true }, select: { id: true } });
    await tx.clienteProduto.createMany({
      data: produtos.map((p) => ({ clienteId: cliente.id, produtoId: p.id })),
      skipDuplicates: true,
    });
    return cliente;
  });
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
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    nomeComprador: string;
    telefoneComprador: string;
    localId: string;
    tabelaPrecoId: string;
    setorId: string | null;
    ativo: boolean;
  }>,
): Promise<Cliente> {
  return prisma.cliente.update({ where: { id }, data });
}

// ---- Tabela de preço e setor ----

const clienteInclude = {
  tabelaPreco: { select: { id: true, nome: true } },
  // Setor + vendedores dele: são esses que atendem o cliente.
  setor: {
    select: {
      id: true,
      nome: true,
      vendedores: {
        select: { vendedor: { select: { id: true, nomeCompleto: true } } },
        orderBy: { vendedor: { nomeCompleto: 'asc' } },
      },
    },
  },
} as const;

export type ClienteCompleto = Cliente & {
  tabelaPreco: { id: string; nome: string } | null;
  setor: {
    id: string;
    nome: string;
    vendedores: { vendedor: { id: string; nomeCompleto: string } }[];
  } | null;
};

export function listByLocalCompleto(
  localId: string,
  apenasAtivos: boolean,
): Promise<ClienteCompleto[]> {
  return prisma.cliente.findMany({
    where: { localId, ...(apenasAtivos ? { ativo: true } : {}) },
    include: clienteInclude,
    orderBy: { nome: 'asc' },
  });
}

export function getByIdCompleto(id: string): Promise<ClienteCompleto | null> {
  return prisma.cliente.findUnique({ where: { id }, include: clienteInclude });
}

export function getSetor(id: string) {
  return prisma.setor.findUnique({ where: { id }, select: { id: true, localId: true } });
}

export function tabelaExiste(id: string) {
  return prisma.tabelaPreco.findUnique({ where: { id }, select: { id: true } });
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
