import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import {
  SENHA_TESTE,
  app,
  apagarUsuariosTemporarios,
  criarUsuarioTemporario,
  prisma,
} from './helpers';

afterAll(async () => {
  await apagarUsuariosTemporarios();
  await prisma.$disconnect();
});

describe('a sessão acompanha o estado da conta (só com usuários descartáveis)', () => {
  it('conta desativada perde o acesso na hora, e reativada volta', async () => {
    const { agente, user } = await criarUsuarioTemporario('sess1', 'VENDEDOR');
    expect((await agente.get('/api/auth/me')).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { ativo: false } });
    expect((await agente.get('/api/auth/me')).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: SENHA_TESTE });
    expect(login.status).toBe(401); // desativado não entra
    await prisma.user.update({ where: { id: user.id }, data: { ativo: true } });
    expect((await agente.get('/api/auth/me')).status).toBe(200);
  });

  it('trocar a senha em outro aparelho derruba a sessão antiga', async () => {
    const { agente, user } = await criarUsuarioTemporario('sess2', 'VENDEDOR');
    expect((await agente.get('/api/auth/me')).status).toBe(200);
    await prisma.user.update({
      where: { id: user.id },
      data: { senhaAlteradaEm: new Date(Date.now() + 5000) },
    });
    expect((await agente.get('/api/auth/me')).status).toBe(401);
  });

  it('logout revoga o token: reaproveitar o cookie antigo = 401', async () => {
    const { agente } = await criarUsuarioTemporario('sess3', 'VENDEDOR');
    const cookie = (await agente.get('/api/auth/me')).request.header['Cookie'] as string | undefined;
    await agente.post('/api/auth/logout');
    expect((await agente.get('/api/auth/me')).status).toBe(401);
    if (cookie) {
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    }
  });

  it('senha errada e usuário inexistente dão a MESMA resposta', async () => {
    const { user } = await criarUsuarioTemporario('sess4', 'VENDEDOR');
    const a = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'errada-zz' });
    const b = await request(app)
      .post('/api/auth/login')
      .send({ username: 'TESTE_zz_naoexiste', password: 'errada-zz' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
});
