/** Mostra as consultas SQL de algumas chamadas (cada linha = uma ida ao banco). */
import { MERCADO_X_ID, conferirBancoLimpo, entrar, limparPedidosDeTeste, pedidosCriados, prisma } from '../helpers';

let atual: string[] = [];
(prisma as unknown as { $on: (e: string, f: (q: { query: string }) => void) => void }).$on('query', (q) => {
  atual.push(q.query.replace(/"public"\./g, '').replace(/\s+/g, ' ').slice(0, 110));
});
async function mostrar(nome: string, fn: () => PromiseLike<unknown>) {
  atual = [];
  await fn();
  console.log(`\n== ${nome} (${atual.length})`);
  atual.forEach((l, i) => console.log(String(i + 1).padStart(2), l));
}
async function main() {
  await conferirBancoLimpo();
  const v = await entrar('vendedor2');
  await prisma.user.count();
  try {
    const prods = await v.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
    const ps = prods.body.produtos;
    const c = await v.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID });
    const pid = c.body.pedido.id; pedidosCriados.push(pid);
    const i = await v.post(`/api/pedidos/${pid}/itens`).send({ produto_id: ps[0].id, quantidade: 1 });
    const iid = i.body.pedido.itens[0].id;
    await mostrar('PUT item (mudar quantidade)', () => v.put(`/api/pedidos/${pid}/itens/${iid}`).send({ quantidade: 3 }));
    await mostrar('GET /produtos', () => v.get('/api/produtos').query({ cliente_id: MERCADO_X_ID }));
  } finally { await limparPedidosDeTeste(); await prisma.$disconnect(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
