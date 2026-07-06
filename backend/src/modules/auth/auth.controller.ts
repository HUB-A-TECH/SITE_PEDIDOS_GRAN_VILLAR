import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { env } from '../../config/env';
import { COOKIE_NAME } from '../../middleware/auth';
import { verifyToken } from '../../utils/jwt';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000, // 8 horas
  path: '/',
};

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }

  const result = await authService.login(parsed.data.username, parsed.data.password);
  if (!result) {
    res.status(401).json({ mensagem: 'Usuário ou senha inválidos' });
    return;
  }

  res.cookie(COOKIE_NAME, result.token, cookieOptions);
  res.json({ usuario: result.usuario });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyToken(token);
      const expiraEm = new Date((payload.exp ?? 0) * 1000);
      await authService.revokeToken(payload.jti, payload.sub, expiraEm);
    } catch {
      // token inválido/expirado: nada a revogar
    }
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ mensagem: 'Desconectado com sucesso' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.json({
    usuario: {
      id: user.sub,
      username: user.username,
      type: user.type,
      localId: user.localId,
    },
  });
}
