import { prisma } from './prisma';

/**
 * Carteira de clientes: cada cliente é atendido por um ou mais vendedores
 * (tabela clientes_vendedores). O vendedor só enxerga e só faz pedido para os
 * clientes da própria carteira; o admin continua vendo todos.
 *
 * Ponto único da regra — usado pela lista de clientes, pelo catálogo e pela
 * criação de pedido, para as três não divergirem.
 */

export function getVendedorDoUsuario(usuarioId: string) {
  return prisma.vendedor.findUnique({ where: { usuarioId }, select: { id: true } });
}

/** O usuário (vendedor) atende esse cliente? Admin nunca passa por aqui. */
export async function vendedorAtendeCliente(
  usuarioId: string,
  clienteId: string,
): Promise<boolean> {
  const vendedor = await getVendedorDoUsuario(usuarioId);
  if (!vendedor) return false;
  const vinculo = await prisma.clienteVendedor.findUnique({
    where: { clienteId_vendedorId: { clienteId, vendedorId: vendedor.id } },
    select: { id: true },
  });
  return Boolean(vinculo);
}

/** Clientes da carteira do vendedor (por usuarioId). */
export async function clientesDoUsuarioVendedor(
  usuarioId: string,
  apenasAtivos: boolean,
) {
  const vendedor = await getVendedorDoUsuario(usuarioId);
  if (!vendedor) return [];
  return prisma.cliente.findMany({
    where: {
      ...(apenasAtivos ? { ativo: true } : {}),
      vendedores: { some: { vendedorId: vendedor.id } },
    },
    orderBy: { nome: 'asc' },
  });
}
