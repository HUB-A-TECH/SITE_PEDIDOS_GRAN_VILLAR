import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app, entrar, prisma } from './helpers';

const FAKE = '00000000-0000-4000-8000-000000000000';

afterAll(() => prisma.$disconnect());

describe('catálogo padrão do vendedor (somente leitura)', () => {
  it('exige login (401 sem sessão)', async () => {
    const r = await request(app).get('/api/produtos/catalogo');
    expect(r.status).toBe(401);
  });

  it('lista todos os produtos ativos com os preços da Tabela Padrão', async () => {
    const vendedor = await entrar('vendedor');
    const r = await vendedor.get('/api/produtos/catalogo');
    expect(r.status).toBe(200);
    expect(r.body.tabelaNome).toBe('Tabela Padrão');

    const tabela = await prisma.tabelaPreco.findFirst({
      where: { nome: 'Tabela Padrão' },
      select: { id: true },
    });
    const ativos = await prisma.produto.findMany({
      where: { ativo: true },
      include: {
        tabelaPrecoItens: {
          where: { tabelaId: tabela?.id ?? '00000000-0000-4000-8000-000000000001' },
          select: { preco: true },
        },
      },
      orderBy: [{ categoria: { ordem: 'asc' } }, { nome: 'asc' }],
    });

    expect(r.body.produtos).toHaveLength(ativos.length);
    for (let i = 0; i < ativos.length; i++) {
      const esperado = ativos[i].tabelaPrecoItens[0]
        ? Number(ativos[i].tabelaPrecoItens[0].preco)
        : Number(ativos[i].preco);
      expect(r.body.produtos[i].id).toBe(ativos[i].id);
      expect(r.body.produtos[i].preco).toBeCloseTo(esperado, 2);
    }
  });

  it('vendedor não consegue alterar catálogo, categorias ou tabelas (403) e admin não acessa rota do vendedor (403)', async () => {
    const vendedor = await entrar('vendedor');
    expect((await vendedor.post('/api/admin/produtos').send({})).status).toBe(403);
    expect((await vendedor.put(`/api/admin/produtos/${FAKE}`).send({})).status).toBe(403);
    expect((await vendedor.put(`/api/admin/tabelas/${FAKE}/produtos/${FAKE}`).send({ preco: 1 })).status).toBe(403);
    expect((await vendedor.post('/api/admin/categorias').send({})).status).toBe(403);

    const admin = await entrar('admin');
    expect((await admin.get('/api/produtos/catalogo')).status).toBe(403);
  });
});
