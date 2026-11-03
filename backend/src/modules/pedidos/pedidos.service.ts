import { prisma } from '../../lib/prisma';
import type { Cliente, ItemPedido, Prisma, Produto, Vendedor } from '@prisma/client';
import { isUniqueConstraintError } from '../../utils/prisma-errors';

export function getVendedorByUsuario(usuarioId: string): Promise<Vendedor | null> {
  return prisma.vendedor.findUnique({ where: { usuarioId } });
}

const pedidoInclude = {
  cliente: { select: { id: true, codigo: true, nome: true, localId: true } },
  itens: {
    include: {
      produto: {
        select: {
          id: true,
          codigo: true,
          nome: true,
          categoriaId: true,
          unidadeMedida: true,
          preco: true,
        },
      },
    },
    // Mesma ordem do Novo Pedido: categoria (ordem do admin) e, dentro dela, nome.
    orderBy: [
      { produto: { categoria: { ordem: 'asc' } } },
      { produto: { nome: 'asc' } },
    ] as Prisma.ItemPedidoOrderByWithRelationInput[],
  },
} as const;

/** Pedido salvo (não enviado) do vendedor para um cliente específico, se houver. */
export function getRascunhoPorCliente(vendedorId: string, clienteId: string) {
  return prisma.pedido.findFirst({
    where: { vendedorId, clienteId, status: 'RASCUNHO' },
    orderBy: { criadoEm: 'desc' },
    relationLoadStrategy: 'join',
    include: pedidoInclude,
  });
}

export function getPedidoDoVendedor(id: string, vendedorId: string) {
  return prisma.pedido.findFirst({
    where: { id, vendedorId },
    relationLoadStrategy: 'join',
    include: pedidoInclude,
  });
}

/**
 * Revisões do comercial que ainda descrevem o pedido (não superadas por uma
 * edição posterior do vendedor), da mais antiga para a mais nova.
 */
export const revisoesVigentesInclude = {
  where: { superadaEm: null },
  orderBy: { revisadoEm: 'asc' },
  select: {
    id: true,
    revisadoEm: true,
    alteracoes: true,
    totalAntes: true,
    totalDepois: true,
    vistoPeloVendedorEm: true,
    revisadoPor: { select: { username: true } },
  },
} as const;

const pedidoAdminInclude = {
  ...pedidoInclude,
  vendedor: { select: { id: true, nomeCompleto: true } },
  editadoPor: { select: { username: true } },
  ultimaAlteracaoPor: { select: { username: true } },
  revisoes: revisoesVigentesInclude,
} as const;

/** Pedido completo para a tela de detalhe do admin (qualquer vendedor/cliente). */
export function getPedidoParaAdmin(id: string) {
  return prisma.pedido.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
    include: pedidoAdminInclude,
  });
}

/**
 * Edição/aprovação pelo comercial: marca a revisão da administração
 * (editadoPor, que controla o "Novo"/pendente) E a última alteração.
 */
export function registrarEdicaoAdmin(pedidoId: string, usuarioId: string) {
  const agora = new Date();
  return prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      editadoPorId: usuarioId,
      editadoEm: agora,
      ultimaAlteracaoPorId: usuarioId,
      ultimaAlteracaoEm: agora,
    },
  });
}

/**
 * Registra apenas a última alteração (usado quando o vendedor edita um pedido
 * já enviado). NÃO mexe em editadoPor, para não marcar como "revisado" pelo
 * comercial. As revisões do comercial com alterações deixam de descrever o
 * pedido (ele volta para análise), então ficam marcadas como superadas.
 */
export function registrarUltimaAlteracao(pedidoId: string, usuarioId: string) {
  const agora = new Date();
  return prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { ultimaAlteracaoPorId: usuarioId, ultimaAlteracaoEm: agora },
    }),
    prisma.revisaoPedido.updateMany({
      where: { pedidoId, superadaEm: null },
      data: { superadaEm: agora },
    }),
  ]);
}

// ---- Revisão do comercial ----

/** O que mudou num item: guardado na revisão para o vendedor ver. */
export interface AlteracaoItem {
  produtoId: string;
  codigo: string;
  nome: string;
  unidadeMedida: string;
  removido: boolean;
  quantidadeAntes: number;
  quantidadeDepois: number;
  precoAntes: number;
  precoDepois: number;
}

/** Item como o comercial viu ao abrir (base) e como deixou (novo). */
export interface ItemRevisado {
  itemId: string;
  quantidadeBase: number;
  precoBase: number;
  quantidade: number; // 0 = remover
  precoUnitario: number;
}

/** O pedido mudou no banco depois que o comercial abriu a tela. */
export class PedidoMudouError extends Error {}

const mesmaQuantidade = (a: number, b: number) => Math.abs(a - b) < 0.0005;
const mesmoPreco = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Aplica de uma vez (transação) a revisão confirmada pelo comercial: novas
 * quantidades/preços, itens removidos, totais, o registro do que mudou e a
 * marca de revisão. Antes, confere que os itens no banco ainda são os que o
 * comercial viu — se o vendedor mexeu nesse meio-tempo, lança
 * PedidoMudouError e nada é gravado.
 */
export function aplicarRevisaoComercial(params: {
  pedidoId: string;
  usuarioId: string;
  itens: ItemRevisado[];
  alteracoes: AlteracaoItem[];
}) {
  const { pedidoId, usuarioId, itens, alteracoes } = params;
  const agora = new Date();
  return prisma.$transaction(async (tx) => {
    const atuais = await tx.itemPedido.findMany({ where: { pedidoId } });
    const base = new Map(itens.map((i) => [i.itemId, i]));
    const igual =
      atuais.length === itens.length &&
      atuais.every((a) => {
        const b = base.get(a.id);
        return (
          b &&
          mesmaQuantidade(Number(a.quantidade), b.quantidadeBase) &&
          mesmoPreco(Number(a.precoUnitario), b.precoBase)
        );
      });
    if (!igual) throw new PedidoMudouError();

    const totalAntes =
      Math.round(atuais.reduce((s, it) => s + Number(it.subtotal), 0) * 100) / 100;

    // Só grava o que mudou: cada gravação é uma ida ao banco (na nuvem), e
    // regravar itens iguais deixava a confirmação lenta em pedidos grandes.
    const mudou = (i: ItemRevisado) =>
      !mesmaQuantidade(i.quantidade, i.quantidadeBase) || !mesmoPreco(i.precoUnitario, i.precoBase);
    const removidos = itens.filter((i) => i.quantidade <= 0).map((i) => i.itemId);
    if (removidos.length > 0) {
      await tx.itemPedido.deleteMany({ where: { id: { in: removidos }, pedidoId } });
    }
    await Promise.all(
      itens
        .filter((i) => i.quantidade > 0 && mudou(i))
        .map((i) =>
          tx.itemPedido.update({
            where: { id: i.itemId },
            data: {
              quantidade: i.quantidade,
              precoUnitario: i.precoUnitario,
              subtotal: calcularSubtotal(i.quantidade, i.precoUnitario),
            },
          }),
        ),
    );

    const restantes = await tx.itemPedido.findMany({ where: { pedidoId } });
    const total =
      Math.round(restantes.reduce((s, it) => s + Number(it.subtotal), 0) * 100) / 100;
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        subtotal: total,
        total,
        editadoPorId: usuarioId,
        editadoEm: agora,
        ultimaAlteracaoPorId: usuarioId,
        ultimaAlteracaoEm: agora,
      },
    });
    await tx.revisaoPedido.create({
      data: {
        pedidoId,
        revisadoPorId: usuarioId,
        revisadoEm: agora,
        alteracoes: alteracoes as unknown as Prisma.InputJsonValue,
        totalAntes,
        totalDepois: total,
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 }); // folga: o banco fica na nuvem
}

/** Revisões com alterações ainda não vistas pelo vendedor (aviso no menu). */
export function contarAlteracoesNaoVistas(vendedorId: string) {
  return prisma.revisaoPedido.count({
    where: {
      superadaEm: null,
      vistoPeloVendedorEm: null,
      pedido: { vendedorId, status: 'CONFIRMADO' },
    },
  });
}

/** Pedidos salvos que o vendedor ainda não enviou (aviso "a confirmar" no menu). */
export function contarAConfirmar(vendedorId: string) {
  return prisma.pedido.count({ where: { vendedorId, status: 'RASCUNHO' } });
}

/** Marca como vistas as revisões desses pedidos (só os do próprio vendedor). */
export function marcarAlteracoesVistas(vendedorId: string, pedidoIds: string[]) {
  return prisma.revisaoPedido.updateMany({
    where: {
      pedidoId: { in: pedidoIds },
      vistoPeloVendedorEm: null,
      pedido: { vendedorId },
    },
    data: { vistoPeloVendedorEm: new Date() },
  });
}

export function criarRascunho(
  vendedorId: string,
  localId: string,
  clienteId: string,
) {
  // Sem include: uma única gravação (o controller já tem o cliente e sabe que não há itens).
  return prisma.pedido.create({
    data: { vendedorId, localId, clienteId, status: 'RASCUNHO' },
  });
}

export function excluirPedido(id: string): Promise<unknown> {
  return prisma.pedido.delete({ where: { id } });
}

export function getCliente(id: string): Promise<Cliente | null> {
  return prisma.cliente.findUnique({ where: { id } });
}

export function getProduto(id: string): Promise<Produto | null> {
  return prisma.produto.findUnique({ where: { id } });
}

export function produtoNoMix(clienteId: string, produtoId: string) {
  return prisma.clienteProduto.findFirst({
    where: { clienteId, produtoId, ativo: true },
  });
}

function calcularSubtotal(quantidade: number, preco: number): number {
  return Math.round(quantidade * preco * 100) / 100;
}

/**
 * Define a quantidade de um produto no pedido (cria ou atualiza o item).
 * O preço vem de fora (tabela de preço do cliente), nunca do catálogo direto.
 */
export async function definirItem(
  pedidoId: string,
  produto: Produto,
  quantidade: number,
  preco: number,
): Promise<void> {
  const subtotal = calcularSubtotal(quantidade, preco);
  const existente = await prisma.itemPedido.findFirst({
    where: { pedidoId, produtoId: produto.id },
  });
  if (existente) {
    await prisma.itemPedido.update({
      where: { id: existente.id },
      data: { quantidade, precoUnitario: preco, subtotal },
    });
  } else {
    await prisma.itemPedido.create({
      data: { pedidoId, produtoId: produto.id, quantidade, precoUnitario: preco, subtotal },
    });
  }
}

export async function atualizarQuantidadeItem(
  item: ItemPedido,
  quantidade: number,
): Promise<void> {
  const subtotal = calcularSubtotal(quantidade, Number(item.precoUnitario));
  await prisma.itemPedido.update({
    where: { id: item.id },
    data: { quantidade, subtotal },
  });
}

/**
 * Altera o preço unitário do item apenas neste pedido (não afeta o catálogo).
 * Usado quando o vendedor negocia um desconto/valor especial para o cliente.
 */
export async function atualizarPrecoItem(
  item: ItemPedido,
  precoUnitario: number,
): Promise<void> {
  const subtotal = calcularSubtotal(Number(item.quantidade), precoUnitario);
  await prisma.itemPedido.update({
    where: { id: item.id },
    data: { precoUnitario, subtotal },
  });
}

export function excluirItem(itemId: string): Promise<unknown> {
  return prisma.itemPedido.delete({ where: { id: itemId } });
}

/**
 * Recalcula subtotal/total do pedido a partir dos itens, dentro do banco e numa
 * consulta só: mais rápido (uma ida em vez de duas) e seguro quando duas
 * gravações do mesmo pedido chegam juntas (a soma sempre vê os itens atuais).
 */
export async function recomputarTotais(pedidoId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE pedidos
    SET subtotal = COALESCE((SELECT ROUND(SUM(subtotal), 2) FROM itens_pedido WHERE pedido_id = ${pedidoId}), 0),
        total = COALESCE((SELECT ROUND(SUM(subtotal), 2) FROM itens_pedido WHERE pedido_id = ${pedidoId}), 0)
    WHERE id = ${pedidoId}`;
}

export function atualizarObservacoes(pedidoId: string, observacoes: string) {
  return prisma.pedido.update({
    where: { id: pedidoId },
    data: { observacoes },
  });
}

export function contarItens(pedidoId: string): Promise<number> {
  return prisma.itemPedido.count({ where: { pedidoId } });
}

/** Confirma o rascunho: gera número sequencial por ano e marca CONFIRMADO. */
export async function confirmarPedido(pedidoId: string): Promise<string> {
  const ano = new Date().getFullYear();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const ultimo = await tx.pedido.findFirst({
          where: { numeroPedido: { startsWith: `${ano}-` } },
          orderBy: { numeroPedido: 'desc' },
          select: { numeroPedido: true },
        });
        const seq = ultimo ? Number(ultimo.numeroPedido!.split('-')[1]) + 1 : 1;
        const numero = `${ano}-${String(seq).padStart(6, '0')}`;
        // Só confirma se ainda for rascunho: dois envios ao mesmo tempo (clique
        // duplo, sinal ruim) não renumeram o pedido, o segundo devolve o número já gerado.
        const r = await tx.pedido.updateMany({
          where: { id: pedidoId, status: 'RASCUNHO' },
          data: {
            status: 'CONFIRMADO',
            numeroPedido: numero,
            confirmadoEm: new Date(),
          },
        });
        if (r.count === 0) {
          const atual = await tx.pedido.findUnique({
            where: { id: pedidoId },
            select: { numeroPedido: true },
          });
          if (atual?.numeroPedido) return atual.numeroPedido;
          throw new Error('Pedido não está mais em rascunho');
        }
        return numero;
      });
    } catch (e) {
      if (isUniqueConstraintError(e) && tentativa < 4) continue;
      throw e;
    }
  }
  throw new Error('Não foi possível gerar o número do pedido');
}

export function cancelarPedido(pedidoId: string, motivo: string | null) {
  return prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      status: 'CANCELADO',
      canceladoEm: new Date(),
      motivoCancelamento: motivo,
    },
  });
}

/** Pedido com todos os dados necessários para o TXT / detalhe. */
export function getPedidoCompleto(id: string) {
  return prisma.pedido.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
    include: {
      local: { select: { codigo: true, nome: true, telefone: true } },
      vendedor: { select: { nomeCompleto: true } },
      cliente: {
        select: { codigo: true, nome: true, nomeFantasia: true, cnpj: true },
      },
      itens: {
        include: { produto: true },
        orderBy: [{ produto: { categoria: { ordem: 'asc' } } }, { produto: { nome: 'asc' } }],
      },
    },
  });
}

export interface FiltroAdminPedidos {
  limite?: number;
  vendedorId?: string;
  clienteId?: string;
}

export function listarPedidosAdmin(filtro: FiltroAdminPedidos) {
  return prisma.pedido.findMany({
    where: {
      status: { in: ['CONFIRMADO', 'CANCELADO'] },
      ...(filtro.vendedorId ? { vendedorId: filtro.vendedorId } : {}),
      ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
    },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true } },
      vendedor: { select: { id: true, nomeCompleto: true } },
      editadoPor: { select: { username: true } },
      ultimaAlteracaoPor: { select: { username: true } },
      _count: { select: { itens: true, revisoes: { where: { superadaEm: null } } } },
    },
    orderBy: { confirmadoEm: 'desc' },
    ...(filtro.limite ? { take: filtro.limite } : {}),
  });
}
