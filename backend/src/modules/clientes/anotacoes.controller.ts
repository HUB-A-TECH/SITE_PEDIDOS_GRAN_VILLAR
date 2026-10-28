import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './anotacoes.service';
import { clienteAcessivel } from './clientes.controller';

/**
 * Anotações de visita no perfil do cliente. Quem pode ver o cliente (vendedor
 * do setor ou administração) lê e escreve; cada um edita as próprias e apaga
 * as próprias; a administração apaga qualquer uma.
 */

type Anotacao = Awaited<ReturnType<typeof service.listar>>[number];

const ehAdmin = (req: Request) => req.user!.type !== 'VENDEDOR';

function serialize(a: Anotacao, req: Request) {
  const minha = a.autorId === req.user!.sub;
  return {
    id: a.id,
    texto: a.texto,
    fixada: a.fixada,
    criadoEm: a.criadoEm,
    editadoEm: a.editadoEm,
    autor: a.autor ? a.autor.vendedor?.nomeCompleto ?? a.autor.username : 'Usuário removido',
    podeEditar: minha,
    podeApagar: minha || ehAdmin(req),
  };
}

const textoSchema = z
  .string()
  .trim()
  .min(1, 'Escreva a anotação')
  .max(500, 'A anotação pode ter no máximo 500 caracteres');

export async function listar(req: Request, res: Response): Promise<void> {
  const cliente = await clienteAcessivel(req, res);
  if (!cliente) return;
  const lista = await service.listar(cliente.id);
  res.json({ anotacoes: lista.map((a) => serialize(a, req)) });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const cliente = await clienteAcessivel(req, res);
  if (!cliente) return;
  const parsed = z
    .object({ texto: textoSchema, fixada: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  const a = await service.criar({
    clienteId: cliente.id,
    autorId: req.user!.sub,
    texto: parsed.data.texto,
    fixada: parsed.data.fixada ?? false,
  });
  res.status(201).json(serialize(a, req));
}

/** Carrega a anotação garantindo que ela é deste cliente (e o cliente é acessível). */
async function anotacaoDoCliente(req: Request, res: Response) {
  const cliente = await clienteAcessivel(req, res);
  if (!cliente) return null;
  const a = await service.getById(req.params.anotacaoId);
  if (!a || a.clienteId !== cliente.id) {
    res.status(404).json({ mensagem: 'Anotação não encontrada' });
    return null;
  }
  return a;
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const a = await anotacaoDoCliente(req, res);
  if (!a) return;
  const parsed = z
    .object({ texto: textoSchema.optional(), fixada: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    return;
  }
  const minha = a.autorId === req.user!.sub;
  // Texto: só o autor. Fixar/desafixar: o autor ou a administração.
  if (parsed.data.texto !== undefined && !minha) {
    res.status(403).json({ mensagem: 'Só quem escreveu pode editar a anotação' });
    return;
  }
  if (parsed.data.fixada !== undefined && !minha && !ehAdmin(req)) {
    res.status(403).json({ mensagem: 'Só quem escreveu pode fixar esta anotação' });
    return;
  }
  const atualizada = await service.atualizar(a.id, {
    texto: parsed.data.texto !== undefined && parsed.data.texto !== a.texto ? parsed.data.texto : undefined,
    fixada: parsed.data.fixada,
  });
  res.json(serialize(atualizada, req));
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const a = await anotacaoDoCliente(req, res);
  if (!a) return;
  if (a.autorId !== req.user!.sub && !ehAdmin(req)) {
    res.status(403).json({ mensagem: 'Só quem escreveu ou a administração pode apagar' });
    return;
  }
  await service.excluir(a.id);
  res.json({ mensagem: 'Anotação apagada' });
}
