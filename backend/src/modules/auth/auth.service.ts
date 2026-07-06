import { prisma } from '../../lib/prisma';
import { verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';

export interface LoginResult {
  token: string;
  usuario: {
    id: string;
    username: string;
    type: string;
    localId: string | null;
  };
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResult | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.ativo) {
    return null;
  }

  const senhaOk = await verifyPassword(password, user.passwordHash);
  if (!senhaOk) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ultimoAcesso: new Date() },
  });

  const { token } = signToken({
    id: user.id,
    username: user.username,
    type: user.type,
    localId: user.localId,
  });

  return {
    token,
    usuario: {
      id: user.id,
      username: user.username,
      type: user.type,
      localId: user.localId,
    },
  };
}

export async function revokeToken(
  jti: string,
  usuarioId: string,
  expiraEm: Date,
): Promise<void> {
  await prisma.tokenRevogado.upsert({
    where: { jti },
    create: { jti, usuarioId, expiraEm },
    update: {},
  });
}
