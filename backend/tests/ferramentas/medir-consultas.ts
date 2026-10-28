/**
 * Mede, para as telas/ações principais, quantas consultas SQL cada chamada faz e
 * quanto demora. Roda contra o banco online (autorizado), só no Mercado X, e
 * apaga o pedido que criar.  Uso: PRISMA_CONTAR_CONSULTAS=1 npx tsx tests/ferramentas/medir-consultas.ts
 */
import {
  MERCADO_X_ID,
  conferirBancoLimpo,
  entrar,
  limparPedidosDeTeste,
  pedidosCriados,
  prisma,
} from '../helpers';

let consultas = 0;
(prisma as unknown as { $on: (e: string, f: () => void) => void }).$on('query', () => {
  consultas++;
});

const linhas: string[] = [];
async function medir<T extends { status: number; body: unknown }>(nome: string, fn: () => PromiseLike<T>) {
  consultas = 0;
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  linhas.push(`${nome.padEnd(46)} ${String(r.status).padEnd(4)} ${String(consultas).padStart(3)} consultas  ${String(ms).padStart(5)} ms`);
  return r;
}

async function main() {
  await conferirBancoLimpo();
  const v = await entrar('vendedor2');
  const a = await entrar('admin');
  // aquece a conexão com o banco (a 1ª consulta paga o "acordar" do Neon)
  await prisma.user.count();
  try {
    await medir('GET /auth/me', () => v.get('/api/auth/me'));
    const prods = await medir('GET /produtos (mix do cliente)', () =>
      v.get('/api/produtos').query({ cliente_id: MERCADO_X_ID }),
    );
    const produtos = (prods.body as { produtos: { id: string }[] }).produtos;
    await medir('GET /clientes/:id/fora-do-mix', () => v.get(`/api/clientes/${MERCADO_X_ID}/fora-do-mix`));
    await medir('GET /clientes/:id/historico-itens', () => v.get(`/api/clientes/${MERCADO_X_ID}/historico-itens`));
    await medir('GET /clientes/:id/perfil', () => v.get(`/api/clientes/${MERCADO_X_ID}/perfil`));
    await medir('GET /pedidos/historico (Meus Pedidos / menu)', () => v.get('/api/pedidos/historico').query({ limite: 'tudo' }));
    await medir('GET /pedidos/alteracoes/nao-vistas', () => v.get('/api/pedidos/alteracoes/nao-vistas'));

    const c = await medir('POST /pedidos (criar)', () => v.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID }));
    const pedidoId = (c.body as { pedido: { id: string } }).pedido.id;
    pedidosCriados.push(pedidoId);
    await medir('GET /pedidos/:id', () => v.get(`/api/pedidos/${pedidoId}`));
    const i = await medir('POST item (1ª quantidade)', () =>
      v.post(`/api/pedidos/${pedidoId}/itens`).send({ produto_id: produtos[0].id, quantidade: 1 }),
    );
    const itemId = (i.body as { pedido: { itens: { id: string }[] } }).pedido.itens[0].id;
    await medir('POST item (2ª quantidade)', () =>
      v.post(`/api/pedidos/${pedidoId}/itens`).send({ produto_id: produtos[1].id, quantidade: 2 }),
    );
    await medir('PUT item (mudar quantidade)', () => v.put(`/api/pedidos/${pedidoId}/itens/${itemId}`).send({ quantidade: 3 }));
    await medir('PUT observações', () => v.put(`/api/pedidos/${pedidoId}/observacoes`).send({ observacoes: 'teste de medição' }));
    await medir('DELETE item', () => v.delete(`/api/pedidos/${pedidoId}/itens/${itemId}`));
    await medir('POST confirmar (enviar)', () => v.post(`/api/pedidos/${pedidoId}/confirmar`).send({}));
    await medir('GET /pedidos/:id/pdf', () => v.get(`/api/pedidos/${pedidoId}/pdf`));
    await medir('GET /admin/pedidos (lista do comercial)', () => a.get('/api/admin/pedidos'));
    await medir('GET /admin/pedidos/:id', () => a.get(`/api/admin/pedidos/${pedidoId}`));
  } finally {
    await limparPedidosDeTeste();
    await prisma.$disconnect();
  }
  console.log('\n' + linhas.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
