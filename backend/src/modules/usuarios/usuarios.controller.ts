import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './usuarios.service';
import { isUniqueConstraintError } from '../../utils/prisma-errors';
import { PERFIS, perfilVende } from '../../lib/perfil';

export async function listar(_req: Request, res: Response): Promise<void> {
  const usuarios = await service.listarUsuarios();
  res.json({ usuarios });
}

const criarSchema = z
  .object({
    perfil: z.enum(PERFIS),
    username: z
      .string()
      .min(3, 'Usuário deve ter ao menos 3 caracteres')
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen ou _'),
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
    nomeCompleto: z.string().min(2).max(120).optional(),
    telefone: z.string().max(30).optional(),
    localId: z.string().uuid().optional(),
  })
  .refine((d) => !perfilVende(d.perfil) || (!!d.nomeCompleto && !!d.localId), {
    message: 'Para vender, informe o nome completo e a filial',
  });

export async function criar(req: Request, res: Response): Promise<void> {
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  try {
    const user = await service.criarUsuario(parsed.data);
    res.status(201).json({ usuario: { id: user.id, username: user.username } });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Usuário ou e-mail já cadastrado' });
      return;
    }
    throw e;
  }
}

const atualizarSchema = z.object({
  email: z.string().email().optional(),
  nomeCompleto: z.string().min(2).max(120).optional(),
  telefone: z.string().max(30).optional(),
});

export async function atualizar(req: Request, res: Response): Promise<void> {
  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  try {
    await service.atualizarUsuario(req.params.id, parsed.data);
    res.json({ ok: true });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'E-mail já cadastrado' });
      return;
    }
    throw e;
  }
}

const perfilSchema = z.object({
  perfil: z.enum(['VENDEDOR', 'ADMIN_COMERCIAL', 'COMERCIAL_VENDEDOR']),
  nomeCompleto: z.string().trim().min(2).max(120).optional(),
  localId: z.string().uuid().optional(),
});

export async function mudarPerfil(req: Request, res: Response): Promise<void> {
  const parsed = perfilSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  // O Admin TI não mexe no próprio perfil (evita se trancar para fora).
  if (req.user!.sub === req.params.id) {
    res.status(400).json({ mensagem: 'Você não pode mudar o próprio perfil' });
    return;
  }
  try {
    await service.mudarPerfil(req.params.id, parsed.data.perfil, parsed.data);
  } catch (e) {
    if (e instanceof service.PerfilInvalido) {
      res.status(400).json({ mensagem: e.message });
      return;
    }
    throw e;
  }
  res.json({ ok: true });
}

const ativoSchema = z.object({ ativo: z.boolean() });

export async function alterarAtivo(req: Request, res: Response): Promise<void> {
  const parsed = ativoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  // Impede o admin de desativar a própria conta (evita se trancar para fora).
  if (!parsed.data.ativo && req.user!.sub === req.params.id) {
    res.status(400).json({ mensagem: 'Você não pode desativar a própria conta' });
    return;
  }
  await service.definirAtivo(req.params.id, parsed.data.ativo);
  res.json({ ok: true });
}

const senhaSchema = z.object({ senha: z.string().min(6) });

export async function resetarSenha(req: Request, res: Response): Promise<void> {
  const parsed = senhaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'A senha deve ter ao menos 6 caracteres' });
    return;
  }
  await service.resetarSenha(req.params.id, parsed.data.senha);
  res.json({ ok: true });
}
