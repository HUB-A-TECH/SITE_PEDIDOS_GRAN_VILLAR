import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MERCADO_X_ID, entrar, prisma } from './helpers';

type Agente = Awaited<ReturnType<typeof entrar>>;
let vendedor: Agente;

beforeAll(async () => {
  vendedor = await entrar('vendedor2');
});
afterAll(() => prisma.$disconnect());

describe('leituras otimizadas devolvem o mesmo que o cálculo direto no banco (somente leitura)', () => {
  it('preço do catálogo do vendedor = tabela do cliente, com fallback no preço do produto', async () => {
    const r = await vendedor.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
    expect(r.status).toBe(200);
    const cliente = await prisma.cliente.findUnique({
      where: { id: MERCADO_X_ID },
      select: { tabelaPrecoId: true },
    });
    const linhas = cliente?.tabelaPrecoId
      ? await prisma.tabelaPrecoItem.findMany({ where: { tabelaId: cliente.tabelaPrecoId } })
      : [];
    const tabela = new Map(linhas.map((l) => [l.produtoId, Number(l.preco)]));
    const ids = r.body.produtos.map((p: { id: string }) => p.id);
    const noBanco = await prisma.produto.findMany({ where: { id: { in: ids } } });
    const catalogo = new Map(noBanco.map((p) => [p.id, Number(p.preco)]));
    expect(r.body.produtos.length).toBeGreaterThan(0);
    for (const p of r.body.produtos as { id: string; preco: number }[]) {
      expect(p.preco).toBeCloseTo(tabela.get(p.id) ?? catalogo.get(p.id)!, 2);
    }
  });

  it('o mix devolvido = produtos ativos do mix ativo do cliente', async () => {
    const r = await vendedor.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
    const mix = await prisma.clienteProduto.findMany({
      where: { clienteId: MERCADO_X_ID, ativo: true, produto: { ativo: true } },
      select: { produtoId: true },
    });
    expect(new Set(r.body.produtos.map((p: { id: string }) => p.id))).toEqual(
      new Set(mix.map((m) => m.produtoId)),
    );
  });

  it('histórico por produto = quantidades dos pedidos enviados (máx. 12 por produto)', async () => {
    const r = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/historico-itens`);
    expect(r.status).toBe(200);
    const pedidos = await prisma.pedido.findMany({
      where: { clienteId: MERCADO_X_ID, status: 'CONFIRMADO' },
      orderBy: { confirmadoEm: 'desc' },
      take: 60,
      include: { itens: true },
    });
    const esperado: Record<string, number[]> = {};
    for (const p of pedidos) {
      for (const it of p.itens) {
        const l = (esperado[it.produtoId] ??= []);
        if (l.length < 12) l.push(Number(it.quantidade));
      }
    }
    const recebido = r.body.historico as Record<string, { quantidade: number }[]>;
    expect(Object.keys(recebido).sort()).toEqual(Object.keys(esperado).sort());
    for (const k of Object.keys(esperado)) {
      expect(recebido[k].map((x) => x.quantidade)).toEqual(esperado[k]);
    }
  });

  it('produtos fora do mix = ativos que não estão no mix, com preço efetivo', async () => {
    const r = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/fora-do-mix`);
    expect(r.status).toBe(200);
    const mix = await prisma.clienteProduto.findMany({
      where: { clienteId: MERCADO_X_ID, ativo: true },
      select: { produtoId: true },
    });
    const dentro = new Set(mix.map((m) => m.produtoId));
    const esperados = await prisma.produto.findMany({
      where: { ativo: true, id: { notIn: [...dentro] } },
      select: { id: true },
    });
    expect(new Set(r.body.produtos.map((p: { id: string }) => p.id))).toEqual(
      new Set(esperados.map((p) => p.id)),
    );
  });
});

describe('resumo do menu do vendedor (chamada leve)', () => {
  it('traz só os dois números, iguais à contagem direta no banco', async () => {
    const r = await vendedor.get('/api/pedidos/resumo-menu');
    expect(r.status).toBe(200);
    const v = await prisma.vendedor.findFirst({ where: { usuario: { username: 'vendedor2' } } });
    const aConfirmar = await prisma.pedido.count({ where: { vendedorId: v!.id, status: 'RASCUNHO' } });
    const alteracoes = await prisma.revisaoPedido.count({
      where: {
        superadaEm: null,
        vistoPeloVendedorEm: null,
        pedido: { vendedorId: v!.id, status: 'CONFIRMADO' },
      },
    });
    expect(r.body).toEqual({ aConfirmar, alteracoes });
  });

  it('administração não usa este resumo (403)', async () => {
    const adm = await entrar('admin');
    expect((await adm.get('/api/pedidos/resumo-menu')).status).toBe(403);
  });
});
