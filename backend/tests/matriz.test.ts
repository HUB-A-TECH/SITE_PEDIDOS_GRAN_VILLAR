import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MERCADO_X_ID,
  app,
  apagarUsuariosTemporarios,
  conferirBancoLimpo,
  criarUsuarioTemporario,
  entrar,
  limparPedidosDeTeste,
  pedidosCriados,
  prisma,
} from './helpers';

type Agente = Awaited<ReturnType<typeof entrar>>;
const FAKE = '00000000-0000-4000-8000-000000000000';

let v1: Agente; // vendedor2: atende o setor do Mercado X
let v2: Agente; // vendedor temporário SEM setor: não atende o Mercado X
let ac: Agente; // admin comercial temporário
let ti: Agente; // admin TI
let pedidoId: string;
let itemId: string;
let preco: number;

beforeAll(async () => {
  await conferirBancoLimpo();
  v1 = await entrar('vendedor2');
  ti = await entrar('admin');
  v2 = (await criarUsuarioTemporario('v2', 'VENDEDOR')).agente;
  ac = (await criarUsuarioTemporario('ac', 'ADMIN_COMERCIAL')).agente;
  const prods = await v1.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
  const produtoId = prods.body.produtos[0].id;
  preco = prods.body.produtos[0].preco;
  const c = await v1.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID });
  pedidoId = c.body.pedido.id;
  pedidosCriados.push(pedidoId);
  const i = await v1
    .post(`/api/pedidos/${pedidoId}/itens`)
    .send({ produto_id: produtoId, quantidade: 1 });
  itemId = i.body.pedido.itens[0].id;
});

afterAll(async () => {
  await limparPedidosDeTeste();
  await apagarUsuariosTemporarios();
  await prisma.$disconnect();
});

type Chamada = [metodo: 'get' | 'post' | 'put' | 'patch' | 'delete', rota: string];

// Rotas de administração (qualquer método): corpo vazio e ids falsos — a barreira
// de permissão precisa responder ANTES de qualquer efeito.
const ROTAS_ADMIN: Chamada[] = [
  ['get', '/api/admin/setores'],
  ['post', '/api/admin/setores'],
  ['put', '/api/admin/setores/ordem'],
  ['get', `/api/admin/setores/${FAKE}`],
  ['put', `/api/admin/setores/${FAKE}`],
  ['delete', `/api/admin/setores/${FAKE}`],
  ['put', `/api/admin/setores/${FAKE}/clientes/${FAKE}`],
  ['delete', `/api/admin/setores/${FAKE}/clientes/${FAKE}`],
  ['post', '/api/admin/categorias'],
  ['put', '/api/admin/categorias/ordem'],
  ['put', `/api/admin/categorias/${FAKE}`],
  ['delete', `/api/admin/categorias/${FAKE}`],
  ['get', '/api/admin/tabelas'],
  ['post', '/api/admin/tabelas'],
  ['get', `/api/admin/tabelas/${FAKE}`],
  ['put', `/api/admin/tabelas/${FAKE}`],
  ['get', '/api/admin/clientes'],
  ['post', '/api/admin/clientes'],
  ['put', `/api/admin/clientes/${FAKE}`],
  ['get', `/api/admin/clientes/${FAKE}/produtos`],
  ['post', `/api/admin/clientes/${FAKE}/produtos`],
  ['post', `/api/admin/clientes/${FAKE}/produtos/todos`],
  ['delete', `/api/admin/clientes/${FAKE}/produtos/todos`],
  ['get', '/api/admin/produtos'],
  ['post', '/api/admin/produtos'],
  ['put', `/api/admin/produtos/${FAKE}`],
  ['post', `/api/admin/produtos/${FAKE}/clientes`],
  ['get', '/api/admin/pedidos'],
  ['get', `/api/admin/pedidos/${FAKE}`],
  ['get', `/api/admin/pedidos/${FAKE}/pdf`],
  ['get', `/api/admin/pedidos/${FAKE}/txt`],
  ['post', `/api/admin/pedidos/${FAKE}/aprovar`],
  ['post', `/api/admin/pedidos/${FAKE}/revisao`],
  ['get', '/api/locais'],
  ['put', `/api/locais/${FAKE}`],
];
const ROTAS_SO_TI: Chamada[] = [
  ['get', '/api/admin/usuarios'],
  ['post', '/api/admin/usuarios'],
  ['put', `/api/admin/usuarios/${FAKE}`],
  ['patch', `/api/admin/usuarios/${FAKE}/ativo`],
  ['post', `/api/admin/usuarios/${FAKE}/senha`],
  ['put', `/api/locais/${FAKE}`],
];
const ROTAS_LOGADO: Chamada[] = [
  ['get', '/api/clientes'],
  ['get', `/api/clientes/${MERCADO_X_ID}/perfil`],
  ['get', `/api/clientes/${MERCADO_X_ID}/anotacoes`],
  ['post', `/api/clientes/${MERCADO_X_ID}/anotacoes`],
  ['get', '/api/pedidos/historico'],
  ['get', '/api/pedidos/resumo-menu'],
  ['post', '/api/pedidos'],
  ['get', `/api/pedidos/${FAKE}`],
  ['put', `/api/pedidos/${FAKE}/itens/${FAKE}/preco`],
  ['post', `/api/pedidos/${FAKE}/confirmar`],
  ['get', `/api/pedidos/${FAKE}/pdf`],
  ['get', '/api/produtos'],
  ['get', '/api/conta'],
  ['put', '/api/conta/senha'],
  ['get', '/api/auth/me'],
];

const chamar = (ag: Agente | ReturnType<typeof request>, [m, r]: Chamada) =>
  (ag as unknown as Record<string, (r: string) => request.Test>)[m](r).send({});

describe('sem login: tudo é 401', () => {
  it.each([...ROTAS_ADMIN, ...ROTAS_SO_TI, ...ROTAS_LOGADO])('%s %s', async (m, r) => {
    const res = await chamar(request(app), [m, r]);
    expect(res.status).toBe(401);
  });

  it('cookie adulterado = 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=abc.def.ghi');
    expect(res.status).toBe(401);
  });
});

describe('vendedor (com setor ou sem): rotas de administração = 403', () => {
  it.each([...ROTAS_ADMIN, ...ROTAS_SO_TI])('com setor: %s %s', async (m, r) => {
    expect((await chamar(v1, [m, r])).status).toBe(403);
  });
  it.each([...ROTAS_ADMIN, ...ROTAS_SO_TI])('sem setor: %s %s', async (m, r) => {
    expect((await chamar(v2, [m, r])).status).toBe(403);
  });
});

describe('admin comercial x admin TI', () => {
  it.each(ROTAS_SO_TI)('comercial NAO acessa %s %s (403)', async (m, r) => {
    expect((await chamar(ac, [m, r])).status).toBe(403);
  });

  it('comercial e TI leem as telas de administração (200)', async () => {
    for (const ag of [ac, ti]) {
      for (const r of [
        '/api/admin/tabelas',
        '/api/admin/pedidos',
        '/api/admin/produtos',
        '/api/locais',
      ]) {
        expect((await ag.get(r)).status, r).toBe(200);
      }
    }
    expect((await ti.get('/api/admin/usuarios')).status).toBe(200);
    // estas duas telas exigem local_id: sem ele, 400 (mas só para quem tem permissão)
    for (const ag of [ac, ti]) {
      expect((await ag.get('/api/admin/setores')).status).toBe(400);
      expect((await ag.get('/api/admin/clientes')).status).toBe(400);
    }
  });

  it('administração não cria pedido (é tela de vendedor): 403', async () => {
    expect((await ac.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID })).status).toBe(403);
    expect((await ti.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID })).status).toBe(403);
  });

  it('administração não mexe no pedido do vendedor pelas rotas de vendedor (403)', async () => {
    for (const ag of [ac, ti]) {
      expect((await ag.get(`/api/pedidos/${pedidoId}`)).status).toBe(403);
      expect(
        (await ag.put(`/api/pedidos/${pedidoId}/itens/${itemId}`).send({ quantidade: 9 })).status,
      ).toBe(403);
      expect((await ag.post(`/api/pedidos/${pedidoId}/confirmar`).send({})).status).toBe(403);
      expect((await ag.delete(`/api/pedidos/${pedidoId}`)).status).toBe(403);
    }
  });

  it('revisão do comercial em pedido ainda não enviado é recusada (400/409)', async () => {
    const res = await ac.post(`/api/admin/pedidos/${pedidoId}/revisao`).send({ itens: [] });
    expect([400, 409]).toContain(res.status);
  });
});

describe('vendedor de outro setor não vê nada do Mercado X', () => {
  const rotas: Chamada[] = [
    ['get', `/api/clientes/${MERCADO_X_ID}/perfil`],
    ['get', `/api/clientes/${MERCADO_X_ID}/historico`],
    ['get', `/api/clientes/${MERCADO_X_ID}/historico-itens`],
    ['get', `/api/clientes/${MERCADO_X_ID}/fora-do-mix`],
    ['get', `/api/clientes/${MERCADO_X_ID}/historico-mix`],
    ['get', `/api/clientes/${MERCADO_X_ID}/anotacoes`],
    ['post', `/api/clientes/${MERCADO_X_ID}/anotacoes`],
    ['post', `/api/clientes/${MERCADO_X_ID}/mix`],
  ];
  it.each(rotas)('%s %s = 403', async (m, r) => {
    const res = await chamar(v2, [m, r]);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Mercado X');
  });

  it('lista de clientes: o do setor aparece para v1 e NÃO para v2', async () => {
    const a = await v1.get('/api/clientes');
    const b = await v2.get('/api/clientes');
    expect(JSON.stringify(a.body)).toContain(MERCADO_X_ID);
    expect(JSON.stringify(b.body)).not.toContain(MERCADO_X_ID);
  });

  it('catálogo do cliente de outro setor = 403 e sem produtos no corpo', async () => {
    const res = await v2.get('/api/produtos').query({ cliente_id: MERCADO_X_ID });
    expect(res.status).toBe(403);
    expect(res.body.produtos).toBeUndefined();
  });

  it('não cria pedido nem mexe no pedido alheio (403/404)', async () => {
    expect([403, 404]).toContain(
      (await v2.post('/api/pedidos').send({ cliente_id: MERCADO_X_ID })).status,
    );
    expect((await v2.get(`/api/pedidos/${pedidoId}`)).status).toBe(404);
    expect(
      (await v2.put(`/api/pedidos/${pedidoId}/itens/${itemId}`).send({ quantidade: 9 })).status,
    ).toBe(404);
    expect(
      (await v2.put(`/api/pedidos/${pedidoId}/itens/${itemId}/preco`).send({ preco_unitario: 0.01 }))
        .status,
    ).toBe(404);
    expect((await v2.delete(`/api/pedidos/${pedidoId}/itens/${itemId}`)).status).toBe(404);
    expect(
      (await v2.put(`/api/pedidos/${pedidoId}/observacoes`).send({ observacoes: 'x' })).status,
    ).toBe(404);
    expect((await v2.post(`/api/pedidos/${pedidoId}/confirmar`).send({})).status).toBe(404);
    expect((await v2.delete(`/api/pedidos/${pedidoId}`)).status).toBe(404);
    expect((await v2.get(`/api/pedidos/${pedidoId}/txt`)).status).toBe(404);
  });

  it('o pedido do dono continua intacto depois das tentativas', async () => {
    const r = await v1.get(`/api/pedidos/${pedidoId}`);
    expect(r.status).toBe(200);
    expect(r.body.pedido.itens).toHaveLength(1);
    expect(r.body.pedido.itens[0].quantidade).toBe(1);
  });
});

describe('ataques ao preço e à quantidade (burlando a tela)', () => {
  it.each([
    ['negativo', -1],
    ['zero', 0],
    ['texto', 'abc'],
    ['vazio', null],
    ['1e9', 1e9],
    ['acima da tabela', 999],
  ])('preço %s é recusado (400)', async (_n, valor) => {
    const r = await v1
      .put(`/api/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .send({ preco_unitario: valor });
    expect(r.status).toBe(400);
  });

  it.each([
    ['negativa', -3],
    ['texto', 'dez'],
    ['enorme', 1e12],
  ])('quantidade %s é recusada (400)', async (_n, valor) => {
    const r = await v1.put(`/api/pedidos/${pedidoId}/itens/${itemId}`).send({ quantidade: valor });
    expect(r.status).toBe(400);
  });

  it('campos extras (type, vendedorId, localId, subtotal) são ignorados', async () => {
    const r = await v1.put(`/api/pedidos/${pedidoId}/itens/${itemId}`).send({
      quantidade: 2,
      type: 'ADMIN_TI',
      vendedorId: FAKE,
      localId: FAKE,
      subtotal: 0.01,
      precoUnitario: 0.01,
    });
    expect(r.status).toBe(200);
    const item = r.body.pedido.itens[0];
    expect(item.quantidade).toBe(2);
    expect(item.precoUnitario).toBeCloseTo(preco, 2);
    expect(item.subtotal).toBeCloseTo(preco * 2, 2);
    expect((await v1.get('/api/auth/me')).body.usuario.type).toBe('VENDEDOR');
  });

  it('item inexistente na URL = 404', async () => {
    const r = await v1
      .put(`/api/pedidos/${pedidoId}/itens/${FAKE}/preco`)
      .send({ preco_unitario: 0.01 });
    expect(r.status).toBe(404);
  });
});

describe('Minha Conta', () => {
  it('trocar senha sem a senha atual / com senha errada não passa', async () => {
    const sem = await v1.put('/api/conta/senha').send({ senha_nova: 'Qualquer#123' });
    expect([400, 403]).toContain(sem.status);
    const errada = await v1
      .put('/api/conta/senha')
      .send({ senha_atual: 'errada-zz', senha_nova: 'Qualquer#123' });
    expect([400, 403]).toContain(errada.status);
    await entrar('vendedor2'); // a senha do vendedor2 continua a mesma
  });
});
