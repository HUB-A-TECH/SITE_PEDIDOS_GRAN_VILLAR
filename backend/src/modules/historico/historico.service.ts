import { prisma } from '../../lib/prisma';

/**
 * Interpreta o parâmetro de limite: "tudo" -> undefined (sem limite);
 * um número válido (1..500) -> aquele número; caso contrário, padrão 12.
 * Assim o histórico se adapta à frequência de cada cliente.
 */
export function parseLimite(valor: unknown): number | undefined {
  if (valor === 'tudo' || valor === 'all') return undefined;
  const n = Number(valor);
  if (Number.isInteger(n) && n > 0 && n <= 500) return n;
  return 12;
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

/**
 * Pedidos confirmados de um cliente, mais recentes primeiro.
 * `limite` = quantos pedidos trazer (undefined = todos).
 */
export function pedidosConfirmadosDoCliente(clienteId: string, limite?: number) {
  return prisma.pedido.findMany({
    where: { clienteId, status: 'CONFIRMADO' },
    include: itemInclude,
    orderBy: { confirmadoEm: 'desc' },
    ...(limite ? { take: limite } : {}),
  });
}

/**
 * Produtos frequentes do cliente com quantidades sugeridas.
 * Só inclui produtos que AINDA estão no mix ativo (RN-11).
 */
export async function produtosFrequentes(clienteId: string, limite = 12) {
  const [pedidos, mix] = await Promise.all([
    pedidosConfirmadosDoCliente(clienteId, limite),
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
  maxPorProduto = 12,
): Promise<Record<string, { data: Date; quantidade: number }[]>> {
  // Últimos 60 pedidos garantem 12 compras de cada produto mesmo em mix grande.
  const pedidos = await pedidosConfirmadosDoCliente(clienteId, 60);
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

/** Pedidos confirmados/cancelados do próprio vendedor (mais recentes primeiro). */
export function meusPedidos(vendedorId: string, limite?: number) {
  return prisma.pedido.findMany({
    where: {
      vendedorId,
      status: { in: ['CONFIRMADO', 'CANCELADO'] },
    },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { confirmadoEm: 'desc' },
    ...(limite ? { take: limite } : {}),
  });
}
