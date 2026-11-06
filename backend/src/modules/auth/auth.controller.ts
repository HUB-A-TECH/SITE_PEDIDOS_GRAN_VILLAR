import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { env } from '../../config/env';
import { COOKIE_NAME } from '../../middleware/auth';
import { signToken, verifyToken } from '../../utils/jwt';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax' as const,
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

/**
 * Quem está conectado. Lê do banco (e não só do token) para refletir na hora
 * uma troca de usuário feita em outro aparelho, em "Minha Conta".
 */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getUsuarioSessao(req.user!.sub);
  if (!user) {
    res.status(401).json({ mensagem: 'Não autenticado' });
    return;
  }
  res.json({ usuario: authService.usuarioSessao(user, req.user!.type) });
}

const modoSchema = z.object({ modo: z.enum(['VENDEDOR', 'ADMIN_COMERCIAL']) });

/**
 * Troca de modo de quem é Comercial + Vendedor (o botão no topo da tela).
 * Emite um token novo no modo escolhido e encerra o anterior.
 */
export async function trocarModo(req: Request, res: Response): Promise<void> {
  const parsed = modoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Modo inválido' });
    return;
  }
  const user = await authService.getUsuarioSessao(req.user!.sub);
  if (!user) {
    res.status(401).json({ mensagem: 'Não autenticado' });
    return;
  }
  const usuario = authService.usuarioSessao(user, parsed.data.modo);
  if (usuario.type !== parsed.data.modo) {
    res.status(403).json({ mensagem: 'Sua conta não tem esse modo de acesso' });
    return;
  }
  const atual = req.user!;
  await authService.revokeToken(atual.jti, atual.sub, new Date((atual.exp ?? 0) * 1000));
  const { token } = signToken(usuario);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ usuario });
}
