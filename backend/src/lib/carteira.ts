import { prisma } from './prisma';

/**
 * Carteira de clientes por setor: o admin coloca vendedores e clientes em
 * setores (regiões). O vendedor só enxerga e só faz pedido para os clientes dos
 * setores em que está; o admin continua vendo todos.
 *
 * Ponto único da regra — usado pela lista de clientes, pelo catálogo e pela
 * criação de pedido, para as três não divergirem.
 */

export function getVendedorDoUsuario(usuarioId: string) {
  return prisma.vendedor.findUnique({ where: { usuarioId }, select: { id: true } });
}

/** Filtro "cliente está num setor deste vendedor". */
function doSetorDoVendedor(vendedorId: string) {
  return { setor: { vendedores: { some: { vendedorId } } } };
}

/** O usuário (vendedor) atende esse cliente? Admin nunca passa por aqui. */
export async function vendedorAtendeCliente(
  usuarioId: string,
  clienteId: string,
): Promise<boolean> {
  const vendedor = await getVendedorDoUsuario(usuarioId);
  if (!vendedor) return false;
  const total = await prisma.cliente.count({
    where: { id: clienteId, ...doSetorDoVendedor(vendedor.id) },
  });
  return total > 0;
}

/** Clientes dos setores do vendedor (por usuarioId), com o setor de cada um. */
export async function clientesDoUsuarioVendedor(
  usuarioId: string,
  apenasAtivos: boolean,
) {
  const vendedor = await getVendedorDoUsuario(usuarioId);
  if (!vendedor) return [];
  return prisma.cliente.findMany({
    where: {
      ...(apenasAtivos ? { ativo: true } : {}),
      ...doSetorDoVendedor(vendedor.id),
    },
    include: { setor: { select: { id: true, nome: true } } },
    orderBy: { nome: 'asc' },
  });
}
