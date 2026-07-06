import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Cliente } from '@prisma/client';
import * as service from './clientes.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

function serialize(c: Cliente) {
  return {
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    nomeFantasia: c.nomeFantasia,
    cnpj: c.cnpj,
    email: c.email,
    telefone: c.telefone,
    endereco: c.endereco,
    localId: c.localId,
    ativo: c.ativo,
  };
}

/** Lista clientes: vendedor vê os do próprio local; admin escolhe via local_id. */
export async function listar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    local_id: z.string().uuid().optional(),
    ativos: z.enum(['true', 'false']).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos' });
    return;
  }

  const isVendedor = req.user!.type === 'VENDEDOR';
  const localId = isVendedor ? req.user!.localId : parsed.data.local_id;
  if (!localId) {
    res.status(400).json({ mensagem: 'local_id é obrigatório para este usuário' });
    return;
  }

  const apenasAtivos = parsed.data.ativos !== 'false';
  const clientes = await service.listByLocal(localId, apenasAtivos);
  res.json({ clientes: clientes.map(serialize) });
}

// ---- Admin ----

const clienteCreateSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  localId: z.string().uuid(),
});

const clienteUpdateSchema = clienteCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export async function adminListar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    local_id: z.string().uuid(),
    ativos: z.enum(['true', 'false']).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'local_id é obrigatório' });
    return;
  }
  const clientes = await service.listByLocal(
    parsed.data.local_id,
    parsed.data.ativos !== 'false',
  );
  res.json({ clientes: clientes.map(serialize) });
}

export async function adminCriar(req: Request, res: Response): Promise<void> {
  const parsed = clienteCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const cliente = await service.criar(parsed.data);
    res.status(201).json(serialize(cliente));
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe um cliente com esse código' });
      return;
    }
    throw e;
  }
}

export async function adminAtualizar(req: Request, res: Response): Promise<void> {
  const parsed = clienteUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const cliente = await service.atualizar(req.params.id, parsed.data);
    res.json(serialize(cliente));
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Cliente não encontrado' });
      return;
    }
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe um cliente com esse código' });
      return;
    }
    throw e;
  }
}

// ---- Mix do cliente (admin) ----

export async function mixListar(req: Request, res: Response): Promise<void> {
  const cliente = await service.getById(req.params.id);
  if (!cliente) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  const mix = await service.listMix(req.params.id);
  res.json({
    produtos: mix.map((cp) => ({
      id: cp.produto.id,
      codigo: cp.produto.codigo,
      nome: cp.produto.nome,
      categoria: cp.produto.categoria,
      ativo: cp.produto.ativo,
    })),
  });
}

export async function mixAdicionar(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ produto_id: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'produto_id é obrigatório' });
    return;
  }
  const cliente = await service.getById(req.params.id);
  if (!cliente) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  const produto = await service.produtoExiste(parsed.data.produto_id);
  if (!produto) {
    res.status(404).json({ mensagem: 'Produto não encontrado' });
    return;
  }
  await service.addAoMix(req.params.id, parsed.data.produto_id);
  res.status(201).json({
    clienteId: req.params.id,
    produtoId: parsed.data.produto_id,
    mensagem: 'Produto adicionado ao mix',
  });
}

export async function mixRemover(req: Request, res: Response): Promise<void> {
  const count = await service.removerDoMix(req.params.id, req.params.produtoId);
  if (count === 0) {
    res.status(404).json({ mensagem: 'Produto não estava no mix do cliente' });
    return;
  }
  res.json({ mensagem: 'Produto removido do mix' });
}
