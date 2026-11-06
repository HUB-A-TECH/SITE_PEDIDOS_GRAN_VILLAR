import { prisma } from '../../lib/prisma';
import { verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { modosDaConta } from '../../lib/perfil';
import type { UserType } from '@prisma/client';

export interface LoginResult {
  token: string;
  usuario: {
    id: string;
    username: string;
    type: string;
    localId: string | null;
    modos: string[];
  };
}

const sessaoSelect = {
  id: true,
  username: true,
  type: true,
  localId: true,
  vendedor: { select: { ativo: true } },
} as const;

type ContaSessao = {
  id: string;
  username: string;
  type: UserType;
  localId: string | null;
  vendedor: { ativo: boolean } | null;
};

/**
 * Usuário como o site guarda. `type` é o MODO em que a sessão está (para quem é
 * Comercial + Vendedor muda com o botão); `modos` diz para quais ele pode trocar.
 */
export function usuarioSessao(conta: ContaSessao, modo?: string) {
  const modos = modosDaConta(conta.type, Boolean(conta.vendedor?.ativo));
  return {
    id: conta.id,
    username: conta.username,
    type: modo && (modos as string[]).includes(modo) ? modo : modos[0],
    localId: conta.localId,
    modos,
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
  const user = await prisma.user.findUnique({
    where: { username },
    select: { ...sessaoSelect, passwordHash: true, ativo: true },
  });
  const senhaOk = await verifyPassword(password, user?.passwordHash ?? HASH_FALSO);
  if (!user || !user.ativo || !senhaOk) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ultimoAcesso: new Date() },
  });

  const usuario = usuarioSessao(user);
  const { token } = signToken(usuario);
  return { token, usuario };
}

export function getUsuarioSessao(id: string) {
  return prisma.user.findUnique({ where: { id }, select: sessaoSelect });
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
