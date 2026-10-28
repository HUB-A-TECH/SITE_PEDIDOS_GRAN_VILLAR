import { prisma } from '../../lib/prisma';
import type { AcaoMix, Cliente, ClienteProduto, Produto } from '@prisma/client';

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

/** Coloca no mix e registra no histórico (usuarioId = quem fez). */
export async function addAoMix(
  clienteId: string,
  produtoId: string,
  usuarioId: string,
): Promise<ClienteProduto> {
  const [cp] = await prisma.$transaction([
    prisma.clienteProduto.upsert({
      where: { clienteId_produtoId: { clienteId, produtoId } },
      create: { clienteId, produtoId, ativo: true },
      update: { ativo: true },
    }),
    prisma.alteracaoMix.create({
      data: { clienteId, produtoId, usuarioId, acao: 'ADICIONADO_AO_MIX' },
    }),
  ]);
  return cp;
}

/** Tira do mix e registra no histórico. Devolve 0 se não estava no mix. */
export async function removerDoMix(
  clienteId: string,
  produtoId: string,
  usuarioId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.clienteProduto.updateMany({
      where: { clienteId, produtoId, ativo: true },
      data: { ativo: false },
    });
    if (r.count > 0) {
      await tx.alteracaoMix.create({
        data: { clienteId, produtoId, usuarioId, acao: 'REMOVIDO_DO_MIX' },
      });
    }
    return r.count;
  });
}

/**
 * Filtro de categoria do "todos": undefined = todas; null = "Sem categoria";
 * string = aquela categoria.
 */
type FiltroCategoria = string | null | undefined;
const porCategoria = (categoriaId: FiltroCategoria) =>
  categoriaId === undefined ? {} : { categoriaId };

/** Quantos produtos ativos ainda faltam no mix / estão no mix (para confirmar). */
export async function contarParaTodos(clienteId: string, categoriaId: FiltroCategoria) {
  const [faltam, noMix] = await Promise.all([
    prisma.produto.count({
      where: {
        ativo: true,
        ...porCategoria(categoriaId),
        clienteProdutos: { none: { clienteId, ativo: true } },
      },
    }),
    prisma.clienteProduto.count({
      where: { clienteId, ativo: true, produto: porCategoria(categoriaId) },
    }),
  ]);
  return { faltam, noMix };
}

/**
 * Coloca no mix todos os produtos ativos que faltam (da categoria, se houver),
 * de uma vez, e registra cada um no histórico do mix.
 */
export function adicionarTodosAoMix(
  clienteId: string,
  usuarioId: string,
  categoriaId: FiltroCategoria,
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const faltam = await tx.produto.findMany({
        where: {
          ativo: true,
          ...porCategoria(categoriaId),
          clienteProdutos: { none: { clienteId, ativo: true } },
        },
        select: { id: true },
      });
      if (faltam.length === 0) return 0;
      const ids = faltam.map((p) => p.id);
      // Os que já estiveram no mix (ativo=false) voltam; os outros são criados.
      await tx.clienteProduto.updateMany({
        where: { clienteId, produtoId: { in: ids } },
        data: { ativo: true },
      });
      await tx.clienteProduto.createMany({
        data: ids.map((produtoId) => ({ clienteId, produtoId, ativo: true })),
        skipDuplicates: true,
      });
      await tx.alteracaoMix.createMany({
        data: ids.map((produtoId) => ({
          clienteId,
          produtoId,
          usuarioId,
          acao: 'ADICIONADO_AO_MIX' as const,
        })),
      });
      return ids.length;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

/** Tira do mix todos os produtos (da categoria, se houver), com histórico. */
export function removerTodosDoMix(
  clienteId: string,
  usuarioId: string,
  categoriaId: FiltroCategoria,
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const noMix = await tx.clienteProduto.findMany({
        where: { clienteId, ativo: true, produto: porCategoria(categoriaId) },
        select: { produtoId: true },
      });
      if (noMix.length === 0) return 0;
      const ids = noMix.map((cp) => cp.produtoId);
      await tx.clienteProduto.updateMany({
        where: { clienteId, produtoId: { in: ids } },
        data: { ativo: false },
      });
      await tx.alteracaoMix.createMany({
        data: ids.map((produtoId) => ({
          clienteId,
          produtoId,
          usuarioId,
          acao: 'REMOVIDO_DO_MIX' as const,
        })),
      });
      return ids.length;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

export function registrarAlteracaoMix(data: {
  clienteId: string;
  produtoId: string;
  usuarioId: string;
  acao: AcaoMix;
  pedidoId?: string;
}) {
  return prisma.alteracaoMix.create({ data });
}

/** Produtos ativos do catálogo que NÃO estão no mix do cliente. */
export function produtosForaDoMix(clienteId: string): Promise<Produto[]> {
  return prisma.produto.findMany({
    where: {
      ativo: true,
      clienteProdutos: { none: { clienteId, ativo: true } },
    },
    orderBy: [{ categoria: { ordem: 'asc' } }, { nome: 'asc' }],
  });
}

/** Histórico do mix do cliente, mais recentes primeiro. */
export function alteracoesMix(clienteId: string, limite = 100) {
  return prisma.alteracaoMix.findMany({
    where: { clienteId },
    include: {
      produto: { select: { nome: true } },
      usuario: {
        select: { username: true, type: true, vendedor: { select: { nomeCompleto: true } } },
      },
    },
    orderBy: { criadoEm: 'desc' },
    take: limite,
  });
}

export function produtoExiste(id: string): Promise<Produto | null> {
  return prisma.produto.findUnique({ where: { id } });
}
