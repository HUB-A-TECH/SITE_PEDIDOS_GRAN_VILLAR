// Demo: cria ~10 pedidos confirmados (um por mês) para o Mercado X, para o
// histórico por produto ficar rico na tela de pedido. Idempotente.
// Uso: node scripts/seed-historico-mensal.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CODIGOS = ['0341', '0242', '0297', '0686', '0532'];

// quantidades variando por mês (12 meses atrás -> 1 mês atrás)
const QTDS = {
  '0341': [36, 40, 30, 28, 34, 22, 41, 38, 33, 42],
  '0242': [30, 28, 32, 26, 35, 24, 38, 30, 27, 34],
  '0297': [20, 22, 18, 24, 19, 25, 21, 23, 20, 26],
  '0686': [40, 45, 38, 42, 36, 48, 41, 44, 39, 50],
  '0532': [12, 15, 10, 14, 11, 16, 13, 12, 14, 15],
};

function dataMesesAtras(meses) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

async function main() {
  const cliente = await prisma.cliente.findUnique({ where: { codigo: 'CLI001' } });
  if (!cliente) throw new Error('Cliente CLI001 não encontrado.');
  const userVend = await prisma.user.findUnique({
    where: { username: 'vendedor' },
    include: { vendedor: true },
  });
  const vendedor = userVend.vendedor;
  const produtos = await prisma.produto.findMany({ where: { codigo: { in: CODIGOS } } });
  const porCodigo = new Map(produtos.map((p) => [p.codigo, p]));

  for (const p of produtos) {
    await prisma.clienteProduto.upsert({
      where: { clienteId_produtoId: { clienteId: cliente.id, produtoId: p.id } },
      create: { clienteId: cliente.id, produtoId: p.id, ativo: true },
      update: { ativo: true },
    });
  }

  await prisma.pedido.deleteMany({ where: { clienteId: cliente.id, status: 'CONFIRMADO' } });

  const totalMeses = 10;
  for (let i = 0; i < totalMeses; i++) {
    const mesesAtras = totalMeses - i; // 10..1
    const data = dataMesesAtras(mesesAtras);
    const itens = CODIGOS.map((cod) => {
      const prod = porCodigo.get(cod);
      const qtd = QTDS[cod][i];
      const preco = Number(prod.preco);
      return { produtoId: prod.id, quantidade: qtd, precoUnitario: preco, subtotal: Math.round(qtd * preco * 100) / 100 };
    });
    const total = Math.round(itens.reduce((s, x) => s + x.subtotal, 0) * 100) / 100;
    const numero = `${data.getFullYear()}-${String(900 + i).padStart(6, '0')}`;
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
        itens: { create: itens },
      },
    });
  }
  console.log(`Criados ${totalMeses} pedidos mensais para Mercado X.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
