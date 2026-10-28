import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MERCADO_X_ID,
  PADARIA_CENTRAL_ID,
  app,
  conferirBancoLimpo,
  entrar,
  limparPedidosDeTeste,
  pedidosCriados,
  prisma,
} from './helpers';

type Agente = Awaited<ReturnType<typeof entrar>>;

let vendedor: Agente;
let admin: Agente;
let produtoId: string;
let precoTabela: number;

beforeAll(async () => {
  await conferirBancoLimpo();
  vendedor = await entrar('vendedor2');
  admin = await entrar('admin');
  const r = await vendedor.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
  expect(r.status).toBe(200);
  expect(r.body.produtos.length).toBeGreaterThan(0);
  produtoId = r.body.produtos[0].id;
  precoTabela = r.body.produtos[0].preco;
});

afterAll(async () => {
  await limparPedidosDeTeste();
  await prisma.$disconnect();
});

describe('login e sessão', () => {
  it('senha errada = 401, sem cookie = 401', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ username: 'teste-inexistente-zz', password: 'x' });
    expect(r.status).toBe(401);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('logout derruba a sessão', async () => {
    const outro = await entrar('vendedor2');
    expect((await outro.get('/api/auth/me')).status).toBe(200);
    await outro.post('/api/auth/logout');
    expect((await outro.get('/api/auth/me')).status).toBe(401);
  });
});

describe('permissões (403/404 onde deve)', () => {
  const rotasAdmin = [
    '/api/admin/usuarios',
    '/api/admin/pedidos',
    '/api/admin/setores',
    '/api/admin/tabelas',
    '/api/admin/produtos',
    '/api/admin/clientes',
    '/api/admin/categorias',
  ];
  it.each(rotasAdmin)('vendedor não acessa %s', async (rota) => {
    const r = await vendedor.get(rota);
    expect([401, 403]).toContain(r.status);
  });

  it('admin acessa as rotas de administração', async () => {
    for (const rota of ['/api/admin/usuarios', '/api/admin/pedidos', '/api/admin/tabelas']) {
      const r = await admin.get(rota);
      expect(r.status, `${rota}: ${JSON.stringify(r.body)}`).toBe(200);
    }
  });

  it('vendedor não vê nem pede para cliente de outro setor', async () => {
    const perfil = await vendedor.get(`/api/clientes/${PADARIA_CENTRAL_ID}/perfil`);
    expect([403, 404]).toContain(perfil.status);
    const criar = await vendedor.post('/api/pedidos').send({ cliente_id: PADARIA_CENTRAL_ID });
    expect([403, 404]).toContain(criar.status);
  });
});

describe('fluxo do pedido (Mercado X)', () => {
  let pedidoId: string;
  let itemId: string;

  it('cria o pedido e adiciona item', async () => {
    const c = await vendedor.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID });
    expect(c.status).toBeLessThan(300);
    pedidoId = c.body.pedido.id;
    pedidosCriados.push(pedidoId);
    const i = await vendedor
      .post(`/api/pedidos/${pedidoId}/itens`)
      .send({ produto_id: produtoId, quantidade: 2 });
    expect(i.status).toBeLessThan(300);
    itemId = i.body.pedido.itens[0].id;
    expect(i.body.pedido.itens[0].precoUnitario).toBeCloseTo(precoTabela, 2);
  });

  it('preço só pode baixar', async () => {
    const alto = await vendedor
      .put(`/api/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .send({ preco_unitario: precoTabela + 1 });
    expect(alto.status).toBe(400);
    const baixo = await vendedor
      .put(`/api/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .send({ preco_unitario: Number((precoTabela * 0.9).toFixed(2)) });
    expect(baixo.status).toBe(200);
    expect(baixo.body.pedido.itens[0].precoUnitario).toBeLessThan(precoTabela);
    const prod = await prisma.produto.findUnique({ where: { id: produtoId } });
    expect(Number(prod!.preco)).toBeGreaterThan(0); // catálogo intacto
  });

  it('outro vendedor do mesmo setor não é dono do pedido (404)', async () => {
    const outro = await entrar('vendedor');
    const r = await outro.get(`/api/pedidos/${pedidoId}`);
    expect(r.status).toBe(404);
  });

  it('enviar duas vezes em paralelo gera UM número só', async () => {
    const [a, b] = await Promise.all([
      vendedor.post(`/api/pedidos/${pedidoId}/confirmar`).send({}),
      vendedor.post(`/api/pedidos/${pedidoId}/confirmar`).send({}),
    ]);
    const ok = [a, b].filter((r) => r.status === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const depois = await vendedor.post(`/api/pedidos/${pedidoId}/confirmar`).send({});
    expect(depois.status).toBe(200);
    for (const r of ok) expect(r.body.numeroPedido).toBe(depois.body.numeroPedido);
    const noBanco = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    expect(noBanco!.numeroPedido).toBe(depois.body.numeroPedido);
  });

  it('PDF e TXT: 200 para o dono e para o admin, 404 para outro vendedor', async () => {
    const pdf = await vendedor.get(`/api/pedidos/${pedidoId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(String(pdf.headers['content-type'])).toContain('pdf');
    expect((await vendedor.get(`/api/pedidos/${pedidoId}/txt`)).status).toBe(200);
    expect((await admin.get(`/api/pedidos/${pedidoId}/pdf`)).status).toBe(200);
    const outro = await entrar('vendedor');
    expect((await outro.get(`/api/pedidos/${pedidoId}/pdf`)).status).toBe(404);
  });

  it('comercial aprova: o pedido sai da fila de pendentes', async () => {
    const antes = await admin.get(`/api/admin/pedidos/${pedidoId}`);
    expect(antes.status).toBe(200);
    const aprov = await admin.post(`/api/admin/pedidos/${pedidoId}/aprovar`).send({});
    expect(aprov.status).toBe(200);
    const lista = await admin.get('/api/admin/pedidos');
    const meu = lista.body.pedidos.find((p: { pedidoId: string }) => p.pedidoId === pedidoId);
    expect(meu.revisao).toBe('REVISADO');
  });

  it('vendedor não consegue descartar pedido já enviado', async () => {
    const r = await vendedor.delete(`/api/pedidos/${pedidoId}`);
    expect(r.status).toBe(409);
  });
});
