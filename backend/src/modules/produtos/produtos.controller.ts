import type { Request, Response } from 'express';
import { z } from 'zod';
import { Categoria, type Produto } from '@prisma/client';
import * as service from './produtos.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

const categoriaEnum = z.nativeEnum(Categoria);
const unidadeEnum = z.enum(['UND', 'KG', 'G', 'ML', 'L']);

function serialize(p: Produto) {
  return {
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    preco: Number(p.preco),
    unidadeMedida: p.unidadeMedida,
    ativo: p.ativo,
  };
}

/** Garante que o vendedor só acesse clientes do próprio local. */
async function resolverClienteAcessivel(
  req: Request,
  clienteId: string,
): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const cliente = await service.getClienteById(clienteId);
  if (!cliente || !cliente.ativo) {
    return { ok: false, status: 404, msg: 'Cliente não encontrado' };
  }
  if (req.user!.type === 'VENDEDOR' && cliente.localId !== req.user!.localId) {
    return { ok: false, status: 403, msg: 'Cliente pertence a outro local' };
  }
  return { ok: true };
}

export async function listarPorMix(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    cliente_id: z.string().uuid(),
    categoria: categoriaEnum.optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos (cliente_id obrigatório)' });
    return;
  }
  const acesso = await resolverClienteAcessivel(req, parsed.data.cliente_id);
  if (!acesso.ok) {
    res.status(acesso.status).json({ mensagem: acesso.msg });
    return;
  }
  const produtos = await service.listMixDoCliente(
    parsed.data.cliente_id,
    parsed.data.categoria,
  );
  res.json({ produtos: produtos.map(serialize) });
}

export async function buscar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    cliente_id: z.string().uuid(),
    termo: z.string().min(1),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos (cliente_id e termo)' });
    return;
  }
  const acesso = await resolverClienteAcessivel(req, parsed.data.cliente_id);
  if (!acesso.ok) {
    res.status(acesso.status).json({ mensagem: acesso.msg });
    return;
  }
  const produtos = await service.buscarNoMix(parsed.data.cliente_id, parsed.data.termo);
  res.json({ produtos: produtos.map(serialize) });
}

export function categorias(_req: Request, res: Response): void {
  res.json({ categorias: service.listCategoriaValues() });
}

// ---- Admin ----

const produtoCreateSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  categoria: categoriaEnum,
  descricao: z.string().optional(),
  preco: z.number().nonnegative(),
  unidadeMedida: unidadeEnum,
});

const produtoUpdateSchema = produtoCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export async function adminListar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    categoria: categoriaEnum.optional(),
    ativo: z.enum(['true', 'false']).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos' });
    return;
  }
  const produtos = await service.listCatalogo({
    categoria: parsed.data.categoria,
    ativo: parsed.data.ativo ? parsed.data.ativo === 'true' : undefined,
  });
  res.json({ produtos: produtos.map(serialize) });
}

export async function adminCriar(req: Request, res: Response): Promise<void> {
  const parsed = produtoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const produto = await service.criarProduto(parsed.data);
    res.status(201).json(serialize(produto));
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe um produto com esse código' });
      return;
    }
    throw e;
  }
}

export async function adminAtualizar(req: Request, res: Response): Promise<void> {
  const parsed = produtoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const produto = await service.atualizarProduto(req.params.id, parsed.data);
    res.json(serialize(produto));
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Produto não encontrado' });
      return;
    }
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe um produto com esse código' });
      return;
    }
    throw e;
  }
}
