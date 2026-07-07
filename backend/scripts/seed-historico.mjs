// Semeia pedidos CONFIRMADOS de exemplo para demonstrar/testar a Fase 5
// (histórico e sugestões). Idempotente: apaga os confirmados anteriores do
// cliente de teste antes de recriar.
//
// Uso: node scripts/seed-historico.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CODIGOS = ['0341', '0242', '0297', '0686', '0532']; // oregano, canela, alho frito, chá verde, louro

// meses atrás -> [ [codigoProduto, quantidade], ... ]
const PEDIDOS = [
  { meses: 1, itens: [['0341', 10], ['0242', 5], ['0686', 8]] },
  { meses: 2, itens: [['0341', 12], ['0297', 6], ['0532', 4]] },
  { meses: 4, itens: [['0341', 8], ['0242', 6], ['0686', 10], ['0297', 5]] },
];

function dataMesesAtras(meses) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

async function main() {
  const cliente = await prisma.cliente.findUnique({ where: { codigo: 'CLI001' } });
  if (!cliente) throw new Error('Cliente de teste CLI001 (Mercado X) não encontrado.');

  const userVend = await prisma.user.findUnique({
    where: { username: 'vendedor' },
    include: { vendedor: true },
  });
  if (!userVend?.vendedor) throw new Error('Vendedor de teste não encontrado.');
  const vendedor = userVend.vendedor;

  const produtos = await prisma.produto.findMany({ where: { codigo: { in: CODIGOS } } });
  const porCodigo = new Map(produtos.map((p) => [p.codigo, p]));
  for (const c of CODIGOS) {
    if (!porCodigo.has(c)) throw new Error(`Produto ${c} não existe no catálogo.`);
  }

  // Garante os produtos no mix do cliente.
  for (const p of produtos) {
    await prisma.clienteProduto.upsert({
      where: { clienteId_produtoId: { clienteId: cliente.id, produtoId: p.id } },
      create: { clienteId: cliente.id, produtoId: p.id, ativo: true },
      update: { ativo: true },
    });
  }

  // Limpa pedidos confirmados anteriores deste cliente (re-run limpo).
  await prisma.pedido.deleteMany({
    where: { clienteId: cliente.id, status: 'CONFIRMADO' },
  });

  let seq = 1;
  for (const def of PEDIDOS) {
    const data = dataMesesAtras(def.meses);
    const itensData = def.itens.map(([cod, qtd]) => {
      const prod = porCodigo.get(cod);
      const preco = Number(prod.preco);
      const subtotal = Math.round(qtd * preco * 100) / 100;
      return { produtoId: prod.id, quantidade: qtd, precoUnitario: preco, subtotal };
    });
    const total = Math.round(itensData.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    const numero = `${data.getFullYear()}-${String(seq).padStart(6, '0')}`;
    seq += 1;

    await prisma.pedido.create({
      data: {
        numeroPedido: numero,
        vendedorId: vendedor.id,
        clienteId: cliente.id,
        localId: cliente.localId,
        status: 'CONFIRMADO',
        dataPedido: data,
        confirmadoEm: data,
        subtotal: total,
        total,
        itens: { create: itensData },
      },
    });
    console.log(`Pedido ${numero} (${def.meses} meses atrás): ${itensData.length} itens, total R$ ${total}`);
  }

  console.log('Histórico de exemplo semeado para Mercado X.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
