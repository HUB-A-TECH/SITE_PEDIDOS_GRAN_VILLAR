import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 10;

/**
 * Freio contra tentativa de senha em massa. Só conta as FALHAS (resposta 4xx/5xx):
 * login certo não consome o limite. A chave é usuário + IP, para um erro de um
 * vendedor não trancar os outros que usam a mesma operadora.
 */
function criar(chave: (req: Request) => string, mensagem: string) {
  return rateLimit({
    windowMs: JANELA_MS,
    limit: MAX_FALHAS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: chave,
    handler: (_req, res) => {
      res.status(429).json({ mensagem });
    },
  });
}

export const limiteLogin = criar(
  (req) => `${req.ip}|${String(req.body?.username ?? '').toLowerCase().slice(0, 100)}`,
  'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
);

/** Trocar senha/usuário em "Minha Conta" (exigem a senha atual). */
export const limiteConta = criar(
  (req) => `${req.ip}|${req.user?.sub ?? 'anon'}`,
  'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
);
