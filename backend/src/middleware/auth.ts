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
    const revogado = await prisma.tokenRevogado.findUnique({
      where: { jti: payload.jti },
    });
    if (revogado) {
      res.status(401).json({ mensagem: 'Sessão encerrada' });
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
