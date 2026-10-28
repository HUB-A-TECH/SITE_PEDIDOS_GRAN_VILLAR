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

// Hash de uma senha que ninguém usa: serve só para gastar o mesmo tempo do bcrypt
// quando o usuário não existe ou está inativo (não dá para descobrir quem existe
// medindo o tempo da resposta).
const HASH_FALSO = '$2a$10$1qCzLuwAjYOwbR5PCeCgKOFchpt0W3cmewh5m6HRusmgVfYbQarNG';

export async function login(
  username: string,
  password: string,
): Promise<LoginResult | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const senhaOk = await verifyPassword(password, user?.passwordHash ?? HASH_FALSO);
  if (!user || !user.ativo || !senhaOk) {
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

export function getUsuarioSessao(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, type: true, localId: true },
  });
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
