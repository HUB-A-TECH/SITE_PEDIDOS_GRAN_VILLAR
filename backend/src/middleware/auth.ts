import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../utils/jwt';
import type { UserType, Vendedor } from '@prisma/client';
import { modosDaConta } from '../lib/perfil';
import { prisma } from '../lib/prisma';

export const COOKIE_NAME = 'gv_token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      /** Vendedor do usuário logado (já carregado junto com a sessão; só no modo VENDEDOR). */
      vendedor?: Vendedor | null;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ mensagem: 'Não autenticado' });
    return;
  }

  try {
    const payload = verifyToken(token);
    const [revogado, usuario] = await Promise.all([
      prisma.tokenRevogado.findUnique({ where: { jti: payload.jti } }),
      // O vendedor vem junto (mesma ida ao banco): quase toda ação do vendedor
      // precisa dele, e ele diz se a conta ainda pode estar no modo vendedor.
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: { ativo: true, senhaAlteradaEm: true, type: true, vendedor: true },
      }),
    ]);
    if (revogado) {
      res.status(401).json({ mensagem: 'Sessão encerrada' });
      return;
    }
    // Conta desativada pelo Admin TI: derruba a sessão mesmo antes do token expirar.
    if (!usuario || !usuario.ativo) {
      res.status(401).json({ mensagem: 'Conta desativada' });
      return;
    }
    // Senha trocada depois deste login: a sessão é de antes da troca, cai.
    // (iat é em segundos; quem acabou de trocar recebe um token novo, do
    // mesmo segundo ou depois, e continua conectado.)
    if (
      usuario.senhaAlteradaEm &&
      (payload.iat ?? 0) < Math.floor(usuario.senhaAlteradaEm.getTime() / 1000)
    ) {
      res.status(401).json({ mensagem: 'A senha foi alterada. Entre novamente.' });
      return;
    }
    // O modo da sessão (type do token) precisa continuar permitido para a
    // conta: se o Admin TI mudou o perfil da pessoa, a sessão antiga cai.
    const modos = modosDaConta(usuario.type, Boolean(usuario.vendedor?.ativo));
    if (!modos.includes(payload.type as UserType)) {
      res.status(401).json({ mensagem: 'Seu perfil de acesso mudou. Entre novamente.' });
      return;
    }
    req.user = payload;
    req.vendedor = payload.type === 'VENDEDOR' ? usuario.vendedor : null;
    next();
  } catch {
    res.status(401).json({ mensagem: 'Token inválido ou expirado' });
  }
}

export function authorize(...types: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !types.includes(req.user.type)) {
      res.status(403).json({ mensagem: 'Acesso negado' });
      return;
    }
    next();
  };
}
