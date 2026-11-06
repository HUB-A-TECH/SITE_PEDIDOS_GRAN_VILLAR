import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import {
  app,
  apagarUsuariosTemporarios,
  criarUsuarioTemporario,
  entrar,
  prisma,
} from './helpers';

/**
 * Perfil "Comercial + Vendedor": uma conta só, com botão para trocar de modo.
 * Só usuários descartáveis (TESTE_zz_), apagados no fim.
 */
afterAll(async () => {
  await apagarUsuariosTemporarios();
  await prisma.$disconnect();
});

const cookieDe = async (ag: ReturnType<typeof request.agent>) =>
  (await ag.get('/api/auth/me')).request.header['Cookie'] as string | undefined;

describe('Comercial + Vendedor troca de modo', () => {
  it('entra como comercial e troca para vendedor (e volta)', async () => {
    const { agente } = await criarUsuarioTemporario('cv1', 'COMERCIAL_VENDEDOR');

    const me = await agente.get('/api/auth/me');
    expect(me.body.usuario.type).toBe('ADMIN_COMERCIAL');
    expect(me.body.usuario.modos).toEqual(['ADMIN_COMERCIAL', 'VENDEDOR']);
    expect((await agente.get('/api/admin/pedidos')).status).toBe(200);
    expect((await agente.get('/api/pedidos/historico')).status).toBe(403);

    const cookieAntigo = await cookieDe(agente);
    const troca = await agente.post('/api/auth/modo').send({ modo: 'VENDEDOR' });
    expect(troca.status).toBe(200);
    expect(troca.body.usuario.type).toBe('VENDEDOR');

    // No modo vendedor vale tudo do vendedor, e nada da administração.
    expect((await agente.get('/api/pedidos/historico')).status).toBe(200);
    expect((await agente.get('/api/admin/pedidos')).status).toBe(403);
    expect((await agente.get('/api/auth/me')).body.usuario.type).toBe('VENDEDOR');

    // O token do modo anterior foi encerrado.
    if (cookieAntigo) {
      expect((await request(app).get('/api/auth/me').set('Cookie', cookieAntigo)).status).toBe(401);
    }

    const volta = await agente.post('/api/auth/modo').send({ modo: 'ADMIN_COMERCIAL' });
    expect(volta.status).toBe(200);
    expect((await agente.get('/api/admin/pedidos')).status).toBe(200);
  });

  it('quem tem um perfil só não troca de modo (403)', async () => {
    const { agente: comercial } = await criarUsuarioTemporario('cv2', 'ADMIN_COMERCIAL');
    expect((await comercial.post('/api/auth/modo').send({ modo: 'VENDEDOR' })).status).toBe(403);
    expect((await comercial.get('/api/auth/me')).body.usuario.modos).toEqual(['ADMIN_COMERCIAL']);

    const { agente: vendedor } = await criarUsuarioTemporario('cv3', 'VENDEDOR');
    expect((await vendedor.post('/api/auth/modo').send({ modo: 'ADMIN_COMERCIAL' })).status).toBe(
      403,
    );
    expect((await vendedor.post('/api/auth/modo').send({ modo: 'ADMIN_TI' })).status).toBe(400);
  });
});

describe('Admin TI muda o perfil', () => {
  it('comercial vira Comercial + Vendedor e depois volta a ser só comercial', async () => {
    const ti = await entrar('admin');
    const { agente, user } = await criarUsuarioTemporario('cv4', 'ADMIN_COMERCIAL');
    const vendedor2 = await prisma.vendedor.findFirst({
      where: { usuario: { username: 'vendedor2' } },
    });

    // Para vender precisa de nome e filial.
    expect(
      (await ti.patch(`/api/admin/usuarios/${user.id}/perfil`).send({ perfil: 'COMERCIAL_VENDEDOR' }))
        .status,
    ).toBe(400);

    const ok = await ti
      .patch(`/api/admin/usuarios/${user.id}/perfil`)
      .send({ perfil: 'COMERCIAL_VENDEDOR', nomeCompleto: 'Teste cv4', localId: vendedor2!.localId });
    expect(ok.status).toBe(200);

    const lista = await ti.get('/api/admin/usuarios');
    const linha = lista.body.usuarios.find((u: { id: string }) => u.id === user.id);
    expect(linha.perfil).toBe('COMERCIAL_VENDEDOR');

    // Agora pode trocar para vendedor.
    expect((await agente.post('/api/auth/modo').send({ modo: 'VENDEDOR' })).status).toBe(200);

    // Voltou a ser só comercial: a sessão no modo vendedor cai na hora.
    expect(
      (await ti.patch(`/api/admin/usuarios/${user.id}/perfil`).send({ perfil: 'ADMIN_COMERCIAL' }))
        .status,
    ).toBe(200);
    expect((await agente.get('/api/auth/me')).status).toBe(401);
    const vendedor = await prisma.vendedor.findUnique({ where: { usuarioId: user.id } });
    expect(vendedor?.ativo).toBe(false); // cadastro guardado (pedidos antigos), só inativo
  });

  it('não muda o próprio perfil nem o de um Admin TI', async () => {
    const ti = await entrar('admin');
    const eu = (await ti.get('/api/auth/me')).body.usuario.id;
    expect(
      (await ti.patch(`/api/admin/usuarios/${eu}/perfil`).send({ perfil: 'ADMIN_COMERCIAL' })).status,
    ).toBe(400);

    const { user } = await criarUsuarioTemporario('cv5', 'ADMIN_TI');
    expect(
      (await ti.patch(`/api/admin/usuarios/${user.id}/perfil`).send({ perfil: 'ADMIN_COMERCIAL' }))
        .status,
    ).toBe(400);
  });
});
