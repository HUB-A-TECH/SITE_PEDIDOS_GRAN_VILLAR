import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
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

  it('PDF e Excel: 200 para o dono e para o admin, 404 para outro vendedor', async () => {
    const pdf = await vendedor.get(`/api/pedidos/${pedidoId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(String(pdf.headers['content-type'])).toContain('pdf');
    expect(String(pdf.headers['content-disposition'])).toMatch(/filename="Gran_Villar_.*Mercado_X.*\.pdf"/);
    const excel = await vendedor
      .get(`/api/pedidos/${pedidoId}/excel`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(excel.status).toBe(200);
    expect(String(excel.headers['content-type'])).toContain('spreadsheetml.sheet');
    expect(String(excel.headers['content-disposition'])).toMatch(/filename="Gran_Villar_.*Mercado_X.*\.xlsx"/);
    const wb = XLSX.read(excel.body, { type: 'buffer' });
    const linhas = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    });
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas[0]).toHaveLength(2);
    expect((await admin.get(`/api/pedidos/${pedidoId}/pdf`)).status).toBe(200);
    expect((await admin.get(`/api/pedidos/${pedidoId}/excel`)).status).toBe(200);
    const outro = await entrar('vendedor');
    expect((await outro.get(`/api/pedidos/${pedidoId}/pdf`)).status).toBe(404);
    expect((await outro.get(`/api/pedidos/${pedidoId}/excel`)).status).toBe(404);
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

  it('revisão com recado atualiza histórico do produto, marca leitura e preserva histórico ao encerrar', async () => {
    const det = await admin.get(`/api/admin/pedidos/${pedidoId}`);
    expect(det.status).toBe(200);
    const item = det.body.pedido.itens[0];
    const rev = await admin.post(`/api/admin/pedidos/${pedidoId}/revisao`).send({
      itens: [
        {
          itemId: item.id,
          quantidadeBase: item.quantidade,
          precoBase: item.precoUnitario,
          quantidade: 1,
          precoUnitario: item.precoUnitario,
        },
      ],
      recado: 'Só tínhamos 12 pápricas defumadas hoje',
    });
    expect(rev.status).toBe(200);
    expect(rev.body.pedido.alteracoesComercial[0].recado).toBe(
      'Só tínhamos 12 pápricas defumadas hoje',
    );
    expect(rev.body.pedido.alteracoesComercial[0].novo).toBe(true);

    const histItens = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/historico-itens`);
    expect(histItens.status).toBe(200);
    const entradaProd = histItens.body.historico[produtoId]?.[0];
    expect(entradaProd).toBeDefined();
    expect(entradaProd.quantidade).toBe(1);
    expect(entradaProd.quantidadeOriginal).toBe(2);

    const antes = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/anotacoes`);
    expect(antes.status).toBe(200);
    expect(antes.body.avisoUltimoPedido?.pedidoId).toBe(pedidoId);
    expect(antes.body.avisoUltimoPedido.revisoes[0].novo).toBe(true);
    expect(antes.body.avisoUltimoPedido.revisoes[0].vistoPeloVendedorEm).toBeNull();

    const listaAntes = await admin.get('/api/admin/pedidos');
    const itemAntes = listaAntes.body.pedidos.find(
      (p: { pedidoId: string }) => p.pedidoId === pedidoId,
    );
    expect(itemAntes.vistoPeloVendedor).toBe(false);

    const marcou = await vendedor
      .post('/api/pedidos/alteracoes/vistas')
      .send({ pedidoIds: [pedidoId] });
    expect(marcou.status).toBe(200);
    expect(marcou.body.marcadas).toBeGreaterThanOrEqual(1);

    const depois = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/anotacoes`);
    expect(depois.body.avisoUltimoPedido.revisoes[0].novo).toBe(false);
    expect(depois.body.avisoUltimoPedido.revisoes[0].vistoPeloVendedorEm).toBeTruthy();

    const listaDepois = await admin.get('/api/admin/pedidos');
    const itemDepois = listaDepois.body.pedidos.find(
      (p: { pedidoId: string }) => p.pedidoId === pedidoId,
    );
    expect(itemDepois.vistoPeloVendedor).toBe(true);

    const encerrar = await admin.post(`/api/admin/pedidos/${pedidoId}/encerrar-aviso`).send({});
    expect(encerrar.status).toBe(200);
    expect(encerrar.body.pedido.alteracoesComercial).toHaveLength(1);
    expect(encerrar.body.pedido.alteracoesComercial[0].encerradoEm).toBeTruthy();

    const aposEncerrar = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/anotacoes`);
    expect(aposEncerrar.body.avisoUltimoPedido).toBeNull();

    const histCli = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/historico`);
    expect(histCli.status).toBe(200);
    const pedHist = histCli.body.historico.find((h: { pedidoId: string }) => h.pedidoId === pedidoId);
    expect(pedHist.alteracoesComercial).toHaveLength(1);

    let anotId: string | null = null;
    try {
      const criada = await admin
        .post(`/api/clientes/${MERCADO_X_ID}/anotacoes`)
        .send({ texto: 'Teste: fechado quarta à tarde', fixada: true });
      expect(criada.status).toBe(201);
      anotId = criada.body.id;
      expect(criada.body.vistoPeloVendedorEm).toBeNull();

      const okVisto = await vendedor
        .post(`/api/clientes/${MERCADO_X_ID}/anotacoes/vistas`)
        .send({});
      expect(okVisto.status).toBe(200);
      expect(okVisto.body.marcadas).toBeGreaterThanOrEqual(1);

      const listApos = await admin.get(`/api/clientes/${MERCADO_X_ID}/anotacoes`);
      const achada = listApos.body.anotacoes.find((a: { id: string }) => a.id === anotId);
      expect(achada.vistoPeloVendedorEm).toBeTruthy();
    } finally {
      if (anotId) {
        await admin.delete(`/api/clientes/${MERCADO_X_ID}/anotacoes/${anotId}`);
      }
    }
  });

  it('vendedor não consegue descartar pedido já enviado', async () => {
    const r = await vendedor.delete(`/api/pedidos/${pedidoId}`);
    expect(r.status).toBe(409);
  });

  it('admin consegue excluir pedido enviado e ele sai do histórico do cliente', async () => {
    const excl = await admin.post(`/api/admin/pedidos/${pedidoId}/cancelar`).send({});
    expect(excl.status).toBe(200);
    expect(excl.body.pedido.status).toBe('CANCELADO');
    const hist = await vendedor.get(`/api/clientes/${MERCADO_X_ID}/historico`);
    expect(hist.status).toBe(200);
    const ids = (hist.body.historico as { pedidoId: string }[]).map((p) => p.pedidoId);
    expect(ids).not.toContain(pedidoId);
  });
});
