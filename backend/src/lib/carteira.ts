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
  /** Se a requisição já carregou o vendedor (req.vendedor), evita nova consulta. */
  vendedorId?: string,
): Promise<boolean> {
  const id = vendedorId ?? (await getVendedorDoUsuario(usuarioId))?.id;
  if (!id) return false;
  const total = await prisma.cliente.count({
    where: { id: clienteId, ...doSetorDoVendedor(id) },
  });
  return total > 0;
}

/** Ordena clientes de A a Z priorizando o Nome Fantasia (fallback na Razão Social). */
export function ordenarClientesPorFantasia<
  T extends { nome: string; nomeFantasia: string | null; codigo?: string },
>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const pa = a.nomeFantasia?.trim() || a.nome.trim();
    const pb = b.nomeFantasia?.trim() || b.nome.trim();
    return (
      pa.localeCompare(pb, 'pt-BR', { sensitivity: 'base' }) ||
      a.nome.trim().localeCompare(b.nome.trim(), 'pt-BR', { sensitivity: 'base' }) ||
      (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR', { sensitivity: 'base' })
    );
  });
}

/** Clientes dos setores do vendedor (por usuarioId), com o setor de cada um. */
export async function clientesDoUsuarioVendedor(
  usuarioId: string,
  apenasAtivos: boolean,
) {
  const vendedor = await getVendedorDoUsuario(usuarioId);
  if (!vendedor) return [];
  const clientes = await prisma.cliente.findMany({
    where: {
      ...(apenasAtivos ? { ativo: true } : {}),
      ...doSetorDoVendedor(vendedor.id),
    },
    include: { setor: { select: { id: true, nome: true, cor: true, ordem: true } } },
    orderBy: { nome: 'asc' },
  });
  return ordenarClientesPorFantasia(clientes);
}
