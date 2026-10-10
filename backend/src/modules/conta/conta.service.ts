import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../utils/password';

const contaSelect = {
  id: true,
  username: true,
  email: true,
  type: true,
  localId: true,
  vendedor: { select: { nomeCompleto: true, telefone: true } },
} as const;

export function getConta(usuarioId: string) {
  return prisma.user.findUnique({ where: { id: usuarioId }, select: contaSelect });
}

export async function senhaConfere(usuarioId: string, senha: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { passwordHash: true },
  });
  if (!user) return false;
  return verifyPassword(senha, user.passwordHash);
}

/** Dados pessoais. Nome e telefone só existem para vendedor. */
export function atualizarDados(
  usuarioId: string,
  dados: { email?: string; nomeCompleto?: string; telefone?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    if (dados.email !== undefined) {
      await tx.user.update({ where: { id: usuarioId }, data: { email: dados.email } });
    }
    if (dados.nomeCompleto !== undefined || dados.telefone !== undefined) {
      await tx.vendedor.updateMany({
        where: { usuarioId },
        data: {
          ...(dados.nomeCompleto !== undefined ? { nomeCompleto: dados.nomeCompleto } : {}),
          ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
        },
      });
    }
  });
}

export function trocarUsuario(usuarioId: string, username: string) {
  return prisma.user.update({ where: { id: usuarioId }, data: { username } });
}

/**
 * Troca a senha e marca a hora da troca: as sessões abertas antes disso
 * (outros aparelhos) deixam de valer — ver middleware/auth.ts.
 */
export async function trocarSenha(usuarioId: string, novaSenha: string) {
  const passwordHash = await hashPassword(novaSenha);
  return prisma.user.update({
    where: { id: usuarioId },
    data: { passwordHash, senhaAlteradaEm: new Date() },
  });
}
