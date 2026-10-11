import { prisma } from '../../lib/prisma';
import { revisoesVigentesInclude } from '../pedidos/pedidos.service';

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

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const dataDoPedido = (p: { confirmadoEm: Date | null; criadoEm: Date }) =>
  p.confirmadoEm ?? p.criadoEm;

/**
 * Resumo de compras para o perfil do cliente. Tudo calculado dos pedidos
 * confirmados (cancelados e não enviados não contam); as médias e os mais
 * comprados olham os últimos 12 meses, para refletir o cliente de hoje.
 */
export async function resumoDoCliente(clienteId: string) {
  const confirmado = { clienteId, status: 'CONFIRMADO' as const };
  const desde = new Date(Date.now() - 365 * UM_DIA_MS);
  const [totalPedidos, ultimos, doAno] = await Promise.all([
    prisma.pedido.count({ where: confirmado }),
    prisma.pedido.findMany({
      where: confirmado,
      select: {
        id: true,
        numeroPedido: true,
        total: true,
        confirmadoEm: true,
        criadoEm: true,
        _count: { select: { itens: true, revisoes: { where: { superadaEm: null } } } },
      },
      orderBy: { confirmadoEm: { sort: 'desc', nulls: 'last' } },
      take: 5,
    }),
    prisma.pedido.findMany({
      where: {
        ...confirmado,
        OR: [
          { confirmadoEm: { gte: desde } },
          { confirmadoEm: null, criadoEm: { gte: desde } },
        ],
      },
      select: {
        total: true,
        confirmadoEm: true,
        criadoEm: true,
        itens: {
          select: {
            quantidade: true,
            produto: { select: { id: true, nome: true, unidadeMedida: true } },
          },
        },
      },
    }),
  ]);

  // Intervalo médio entre compras: do pedido mais antigo ao mais recente do
  // período, dividido pelo número de intervalos.
  const datas = doAno.map((p) => dataDoPedido(p).getTime()).sort((a, b) => a - b);
  const intervaloMedioDias =
    datas.length >= 2
      ? Math.round((datas[datas.length - 1] - datas[0]) / (datas.length - 1) / UM_DIA_MS)
      : null;

  const ticketMedio =
    doAno.length > 0
      ? Math.round((doAno.reduce((s, p) => s + Number(p.total), 0) / doAno.length) * 100) / 100
      : null;

  // Mais comprados: em quantos pedidos o produto aparece (frequência), e a
  // quantidade média quando aparece.
  const porProduto = new Map<
    string,
    { produtoId: string; nome: string; unidadeMedida: string; pedidos: number; quantidade: number }
  >();
  for (const p of doAno) {
    for (const it of p.itens) {
      const atual = porProduto.get(it.produto.id) ?? {
        produtoId: it.produto.id,
        nome: it.produto.nome,
        unidadeMedida: it.produto.unidadeMedida,
        pedidos: 0,
        quantidade: 0,
      };
      atual.pedidos += 1;
      atual.quantidade += Number(it.quantidade);
      porProduto.set(it.produto.id, atual);
    }
  }
  const maisComprados = [...porProduto.values()]
    .sort((a, b) => b.pedidos - a.pedidos || b.quantidade - a.quantidade)
    .slice(0, 5)
    .map(({ quantidade, ...p }) => ({
      ...p,
      mediaPorPedido: Math.round((quantidade / p.pedidos) * 100) / 100,
    }));

  return {
    resumo: {
      totalPedidos,
      pedidos12Meses: doAno.length,
      ultimaCompra: ultimos[0] ? dataDoPedido(ultimos[0]) : null,
      intervaloMedioDias,
      ticketMedio,
      maisComprados,
    },
    ultimosPedidos: ultimos.map((p) => ({
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      data: dataDoPedido(p),
      total: Number(p.total),
      itensCount: p._count.itens,
      alteradoPeloComercial: p._count.revisoes > 0,
    })),
  };
}

/** Pedido salvo (ainda não enviado) do vendedor para esse cliente, se houver. */
export async function pedidoSalvoId(vendedorId: string, clienteId: string) {
  const p = await prisma.pedido.findFirst({
    where: { vendedorId, clienteId, status: 'RASCUNHO' },
    select: { id: true },
  });
  return p?.id ?? null;
}

/**
 * Todos os pedidos do vendedor (salvos ainda não enviados, enviados e
 * cancelados), mais recentes primeiro. Ordena por criadoEm pois rascunhos
 * ainda não têm confirmadoEm.
 */
const meuPedidoInclude = {
  cliente: { select: { id: true, codigo: true, nome: true } },
  editadoPor: { select: { username: true } },
  ultimaAlteracaoPor: { select: { username: true } },
  _count: { select: { itens: true } },
  // O que o comercial alterou (e ainda vale): o vendedor vê no card.
  revisoes: revisoesVigentesInclude,
} as const;

/**
 * Pedidos do vendedor para a tela "Meus Pedidos".
 *
 * Os ainda não enviados (RASCUNHO) vêm SEMPRE, todos, independentemente do
 * filtro de período: são os que esperam ação do vendedor, e sumir da lista por
 * causa do filtro é justamente como um pedido acabaria esquecido sem nunca
 * chegar ao comercial. O limite vale só para os já resolvidos.
 */
export async function meusPedidos(vendedorId: string, limite?: number) {
  const [aConfirmar, resolvidos] = await Promise.all([
    prisma.pedido.findMany({
      where: { vendedorId, status: 'RASCUNHO' },
      include: meuPedidoInclude,
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.pedido.findMany({
      where: { vendedorId, status: { in: ['CONFIRMADO', 'CANCELADO'] } },
      include: meuPedidoInclude,
      orderBy: { criadoEm: 'desc' },
      ...(limite ? { take: limite } : {}),
    }),
  ]);
  return [...aConfirmar, ...resolvidos];
}
