import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

/**
 * TRAVA DE SEGURANÇA: os testes rodam contra o banco online (mesmo Neon do site),
 * por autorização do dono. Por isso só mexem no cliente de teste "Mercado X" e
 * apagam o que criaram. Nunca usar outro cliente aqui.
 */
export const MERCADO_X_ID = 'db2b8890-906f-4cb7-9d70-a465423fdee2';
// Cliente de setor real: usado só para conferir que o acesso é NEGADO.
export const PADARIA_CENTRAL_ID = 'b42aa745-dbb1-47bf-a3cf-5ecf3fbd0864';

export const SENHAS = {
  admin: ['admin', 'admin123'],
  vendedor2: ['vendedor2', 'vendedor123'],
  vendedor: ['vendedor', 'vendedor123'],
} as const;

export const pedidosCriados: string[] = [];

export async function entrar(quem: keyof typeof SENHAS) {
  const agente = request.agent(app);
  const [username, password] = SENHAS[quem];
  const r = await agente.post('/api/auth/login').send({ username, password });
  if (r.status !== 200) throw new Error(`login de ${quem} falhou (${r.status})`);
  return agente;
}

export async function conferirBancoLimpo() {
  const cliente = await prisma.cliente.findUnique({ where: { id: MERCADO_X_ID } });
  if (cliente?.nome !== 'Mercado X') {
    throw new Error('Cliente de teste não é o Mercado X: abortando.');
  }
  // Há 1 pedido salvo por (vendedor, cliente). Os testes usam o vendedor2; se ELE já
  // tiver rascunho no Mercado X, aborta para não reaproveitar nem apagar nada.
  const sobras = await prisma.pedido.count({
    where: {
      clienteId: MERCADO_X_ID,
      status: 'RASCUNHO',
      vendedor: { usuario: { username: 'vendedor2' } },
    },
  });
  if (sobras > 0) {
    throw new Error('vendedor2 já tem pedido salvo no Mercado X: abortando.');
  }
}

export async function limparPedidosDeTeste() {
  if (pedidosCriados.length === 0) return;
  // Itens e revisões caem em cascata junto com o pedido.
  await prisma.alteracaoMix.deleteMany({ where: { pedidoId: { in: pedidosCriados } } });
  await prisma.pedido.deleteMany({
    where: { id: { in: pedidosCriados }, clienteId: MERCADO_X_ID },
  });
}

export { app, prisma };
