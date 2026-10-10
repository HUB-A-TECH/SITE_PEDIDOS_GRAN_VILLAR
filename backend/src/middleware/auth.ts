import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../utils/jwt';
import { prisma } from '../lib/prisma';

export const COOKIE_NAME = 'gv_token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
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
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: { ativo: true, senhaAlteradaEm: true },
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
    req.user = payload;
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
