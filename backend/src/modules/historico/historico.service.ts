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

/**
 * Todos os pedidos do vendedor (salvos ainda não enviados, enviados e
 * cancelados), mais recentes primeiro. Ordena por criadoEm pois rascunhos
 * ainda não têm confirmadoEm.
 */
export function meusPedidos(vendedorId: string, limite?: number) {
  return prisma.pedido.findMany({
    where: { vendedorId },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true } },
      editadoPor: { select: { username: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { criadoEm: 'desc' },
    ...(limite ? { take: limite } : {}),
  });
}
