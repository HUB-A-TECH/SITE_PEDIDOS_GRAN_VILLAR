import { prisma } from '../../lib/prisma';
import type { Produto } from '@prisma/client';

/**
 * Preço efetivo = preço do produto na tabela do cliente. Se o cliente não tem
 * tabela, ou se a tabela não tem linha para aquele produto, vale o preço do
 * catálogo (Produto.preco) — rede de segurança para nunca cair em zero.
 *
 * Este arquivo é a ÚNICA fonte de verdade do preço: catálogo do vendedor e
 * criação de item de pedido passam por aqui, para não divergirem.
 */

export type MapaPrecos = Map<string, number>;

/** Preços da tabela do cliente, indexados por produtoId. */
export async function mapaPrecosDoCliente(clienteId: string): Promise<MapaPrecos> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { tabelaPrecoId: true },
  });
  if (!cliente?.tabelaPrecoId) return new Map();
  return mapaPrecosDaTabela(cliente.tabelaPrecoId);
}

/** Preços de uma tabela, indexados por produtoId. */
export async function mapaPrecosDaTabela(tabelaId: string): Promise<MapaPrecos> {
  const itens = await prisma.tabelaPrecoItem.findMany({
    where: { tabelaId },
    select: { produtoId: true, preco: true },
  });
  return new Map(itens.map((i) => [i.produtoId, Number(i.preco)]));
}

/** Aplica o mapa a um produto, caindo no preço do catálogo quando faltar. */
export function precoEfetivo(produto: Pick<Produto, 'id' | 'preco'>, mapa: MapaPrecos): number {
  return mapa.get(produto.id) ?? Number(produto.preco);
}

/** Preço de um único produto para um cliente (usado ao montar o pedido). */
export async function precoDoProdutoParaCliente(
  clienteId: string,
  produto: Produto,
): Promise<number> {
  return (await precoNaTabelaDoCliente(clienteId, produto.id)) ?? Number(produto.preco);
}

/**
 * Preço do produto na tabela do cliente, numa consulta só (null = cliente sem
 * tabela ou tabela sem linha para o produto → vale o preço do catálogo).
 * Não depende do produto, então pode rodar em paralelo com a busca dele.
 */
export async function precoNaTabelaDoCliente(
  clienteId: string,
  produtoId: string,
): Promise<number | null> {
  const item = await prisma.tabelaPrecoItem.findFirst({
    where: { produtoId, tabela: { clientes: { some: { id: clienteId } } } },
    select: { preco: true },
  });
  return item ? Number(item.preco) : null;
}
