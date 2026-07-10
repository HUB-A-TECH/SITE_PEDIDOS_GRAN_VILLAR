import { prisma } from '../../lib/prisma';

const PERIODOS_VALIDOS = [3, 6, 12];

export function normalizarPeriodo(valor: unknown): number {
  const n = Number(valor);
  return PERIODOS_VALIDOS.includes(n) ? n : 6;
}

function desdeMeses(meses: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

const itemInclude = {
  itens: {
    include: {
      produto: {
        select: {
          id: true,
          codigo: true,
          nome: true,
          categoria: true,
          unidadeMedida: true,
        },
      },
    },
  },
} as const;

/** Pedidos confirmados de um cliente no período (mais recentes primeiro). */
export function pedidosConfirmadosDoCliente(clienteId: string, meses: number) {
  return prisma.pedido.findMany({
    where: {
      clienteId,
      status: 'CONFIRMADO',
      confirmadoEm: { gte: desdeMeses(meses) },
    },
    include: itemInclude,
    orderBy: { confirmadoEm: 'desc' },
  });
}

/**
 * Produtos frequentes do cliente com quantidades sugeridas.
 * Só inclui produtos que AINDA estão no mix ativo (RN-11).
 */
export async function produtosFrequentes(clienteId: string, meses: number) {
  const [pedidos, mix] = await Promise.all([
    pedidosConfirmadosDoCliente(clienteId, meses),
    prisma.clienteProduto.findMany({
      where: { clienteId, ativo: true },
      select: { produtoId: true },
    }),
  ]);
  const noMix = new Set(mix.map((m) => m.produtoId));

  interface Agg {
    produto: { id: string; codigo: string; nome: string; categoria: string; unidadeMedida: string };
    total: number;
    compras: number;
    ultimaData: Date;
    ultimaQtd: number;
  }
  const agg = new Map<string, Agg>();

  for (const p of pedidos) {
    const data = p.confirmadoEm ?? p.criadoEm;
    for (const it of p.itens) {
      if (!noMix.has(it.produtoId)) continue;
      const q = Number(it.quantidade);
      const cur = agg.get(it.produtoId);
      if (cur) {
        cur.total += q;
        cur.compras += 1;
        if (data > cur.ultimaData) {
          cur.ultimaData = data;
          cur.ultimaQtd = q;
        }
      } else {
        agg.set(it.produtoId, {
          produto: it.produto,
          total: q,
          compras: 1,
          ultimaData: data,
          ultimaQtd: q,
        });
      }
    }
  }

  return [...agg.values()]
    .sort((a, b) => b.compras - a.compras || b.total - a.total)
    .map((a) => ({
      produtoId: a.produto.id,
      codigo: a.produto.codigo,
      nome: a.produto.nome,
      categoria: a.produto.categoria,
      unidadeMedida: a.produto.unidadeMedida,
      quantidadeUltima: a.ultimaQtd,
      quantidadeMedia: Math.round((a.total / a.compras) * 1000) / 1000,
      quantidadeTotal: a.total,
      numeroCompras: a.compras,
    }));
}

/**
 * Histórico por produto do cliente: para cada produto comprado, a lista de
 * { data, quantidade } dos pedidos confirmados (mais recentes primeiro).
 * Uma consulta só, usada na tela de pedido.
 */
export async function historicoPorProduto(
  clienteId: string,
  meses: number,
  maxPorProduto = 12,
): Promise<Record<string, { data: Date; quantidade: number }[]>> {
  const pedidos = await pedidosConfirmadosDoCliente(clienteId, meses);
  const mapa: Record<string, { data: Date; quantidade: number }[]> = {};
  for (const p of pedidos) {
    const data = p.confirmadoEm ?? p.criadoEm;
    for (const it of p.itens) {
      const lista = (mapa[it.produtoId] ??= []);
      if (lista.length < maxPorProduto) {
        lista.push({ data, quantidade: Number(it.quantidade) });
      }
    }
  }
  return mapa;
}

/** Pedidos confirmados/cancelados do próprio vendedor no período. */
export function meusPedidos(vendedorId: string, meses: number) {
  return prisma.pedido.findMany({
    where: {
      vendedorId,
      status: { in: ['CONFIRMADO', 'CANCELADO'] },
      confirmadoEm: { gte: desdeMeses(meses) },
    },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { confirmadoEm: 'desc' },
  });
}
