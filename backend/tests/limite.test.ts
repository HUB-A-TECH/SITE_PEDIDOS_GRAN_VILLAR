import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app, entrar, prisma } from './helpers';

afterAll(() => prisma.$disconnect());

describe('freio de tentativas de senha', () => {
  it('login: 10 falhas do mesmo usuário e a 11ª é barrada (429)', async () => {
    const usuario = 'usuario-que-nao-existe-limite';
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ username: usuario, password: 'errada' });
      expect(r.status).toBe(401);
    }
    const r = await request(app)
      .post('/api/auth/login')
      .send({ username: usuario, password: 'errada' });
    expect(r.status).toBe(429);
  });

  it('o bloqueio de um usuário não atrapalha outro', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vendedor2', password: 'vendedor123' });
    expect(r.status).toBe(200);
  });

  it('login correto não consome o limite', async () => {
    for (let i = 0; i < 12; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ username: 'vendedor2', password: 'vendedor123' });
      expect(r.status).toBe(200);
    }
  });

  it('Minha Conta: senha atual errada 10x e a 11ª é barrada', async () => {
    const ag = await entrar('vendedor2');
    let ultimo = 0;
    for (let i = 0; i < 11; i++) {
      const r = await ag
        .put('/api/conta/senha')
        .send({ senhaAtual: 'errada', novaSenha: 'qualquercoisa123' });
      ultimo = r.status;
    }
    expect(ultimo).toBe(429);
  });
});
