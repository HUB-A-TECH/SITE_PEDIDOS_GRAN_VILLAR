import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './conta.service';
import { cookieOptions } from '../auth/auth.controller';
import { COOKIE_NAME } from '../../middleware/auth';
import { signToken } from '../../utils/jwt';
import { isUniqueConstraintError } from '../../utils/prisma-errors';

/**
 * "Minha Conta": cada usuário muda os próprios dados, usuário de entrada e
 * senha. Usuário e senha pedem a senha atual (se alguém pegar o celular já
 * conectado, não consegue tomar a conta).
 */

type Conta = NonNullable<Awaited<ReturnType<typeof service.getConta>>>;

function serialize(c: Conta) {
  return {
    username: c.username,
    email: c.email,
    type: c.type,
    nomeCompleto: c.vendedor?.nomeCompleto ?? null,
    telefone: c.vendedor?.telefone ?? null,
  };
}

/** Usuário como o AuthContext do site guarda (mesmo formato do login). */
const usuarioSessao = (c: Conta) => ({
  id: c.id,
  username: c.username,
  type: c.type,
  localId: c.localId,
});

/** Emite um token novo para esta sessão (com o usuário atualizado). */
function renovarSessao(res: Response, c: Conta) {
  const { token } = signToken(usuarioSessao(c));
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

async function contaOu404(req: Request, res: Response): Promise<Conta | null> {
  const conta = await service.getConta(req.user!.sub);
  if (!conta) {
    res.status(404).json({ mensagem: 'Conta não encontrada' });
    return null;
  }
  return conta;
}

/** Confere a senha atual; responde 400 se faltar e 403 se estiver errada. */
async function exigirSenhaAtual(req: Request, res: Response, senhaAtual: string): Promise<boolean> {
  if (!(await service.senhaConfere(req.user!.sub, senhaAtual))) {
    res.status(403).json({ mensagem: 'Senha atual incorreta' });
    return false;
  }
  return true;
}

export async function obter(req: Request, res: Response): Promise<void> {
  const conta = await contaOu404(req, res);
  if (conta) res.json(serialize(conta));
}

const dadosSchema = z.object({
  email: z.string().trim().email('E-mail inválido').optional(),
  nomeCompleto: z.string().trim().min(2, 'Nome muito curto').max(120).optional(),
  // Vazio = apagar o telefone.
  telefone: z.string().trim().max(30).optional(),
});

export async function atualizarDados(req: Request, res: Response): Promise<void> {
  const parsed = dadosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  const conta = await contaOu404(req, res);
  if (!conta) return;
  const ehVendedor = Boolean(conta.vendedor);
  if (!ehVendedor && (parsed.data.nomeCompleto !== undefined || parsed.data.telefone !== undefined)) {
    res.status(400).json({ mensagem: 'Nome e telefone existem só na conta de vendedor' });
    return;
  }
  try {
    await service.atualizarDados(conta.id, {
      email: parsed.data.email,
      nomeCompleto: parsed.data.nomeCompleto,
      telefone: parsed.data.telefone === undefined ? undefined : parsed.data.telefone || null,
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Esse e-mail já está em uso por outra conta' });
      return;
    }
    throw e;
  }
  const atualizada = await contaOu404(req, res);
  if (atualizada) res.json(serialize(atualizada));
}

const usuarioSchema = z.object({
  // Mesma regra do cadastro de usuários.
  username: z
    .string()
    .trim()
    .min(3, 'Usuário deve ter ao menos 3 caracteres')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen ou _'),
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
});

export async function trocarUsuario(req: Request, res: Response): Promise<void> {
  const parsed = usuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  if (!(await exigirSenhaAtual(req, res, parsed.data.senhaAtual))) return;
  try {
    await service.trocarUsuario(req.user!.sub, parsed.data.username);
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Esse usuário já existe. Escolha outro.' });
      return;
    }
    throw e;
  }
  const conta = await contaOu404(req, res);
  if (!conta) return;
  // O usuário vai dentro do token da sessão: emite um novo com o nome novo.
  renovarSessao(res, conta);
  res.json({ ...serialize(conta), usuario: usuarioSessao(conta) });
}

const senhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres').max(100),
  })
  .refine((d) => d.senhaAtual !== d.novaSenha, {
    message: 'A nova senha precisa ser diferente da atual',
  });

export async function trocarSenha(req: Request, res: Response): Promise<void> {
  const parsed = senhaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  if (!(await exigirSenhaAtual(req, res, parsed.data.senhaAtual))) return;
  await service.trocarSenha(req.user!.sub, parsed.data.novaSenha);
  const conta = await contaOu404(req, res);
  if (!conta) return;
  // A troca derruba todas as sessões antigas — inclusive o token desta. Este
  // aparelho recebe um token novo e continua conectado; os outros caem.
  renovarSessao(res, conta);
  res.json({ mensagem: 'Senha alterada. Os outros aparelhos foram desconectados.' });
}
