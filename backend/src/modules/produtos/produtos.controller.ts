import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Produto } from '@prisma/client';
import * as service from './produtos.service';
import * as precos from '../precos/precos.service';
import * as carteira from '../../lib/carteira';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

// Categoria = id da tabela categorias; null = sem categoria.
const categoriaId = z.string().uuid();
const unidadeEnum = z.enum(['UND', 'KG', 'G', 'ML', 'L']);

// Atenção: nunca usar `.map(serialize)` — o índice do map viraria o preço.
function serialize(p: Produto, preco = Number(p.preco)) {
  return {
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoriaId,
    descricao: p.descricao,
    preco,
    unidadeMedida: p.unidadeMedida,
    ativo: p.ativo,
  };
}

/** Garante que o vendedor só acesse clientes da própria carteira. */
async function resolverClienteAcessivel(
  req: Request,
  clienteId: string,
): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const cliente = await service.getClienteById(clienteId);
  if (!cliente || !cliente.ativo) {
    return { ok: false, status: 404, msg: 'Cliente não encontrado' };
  }
  if (req.user!.type === 'VENDEDOR') {
    const atende = await carteira.vendedorAtendeCliente(req.user!.sub, cliente.id);
    if (!atende) {
      return { ok: false, status: 403, msg: 'Cliente não está nos seus setores' };
    }
  }
  return { ok: true };
}

export async function listarPorMix(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    cliente_id: z.string().uuid(),
    categoria: categoriaId.optional(),
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
  const mapa = await precos.mapaPrecosDoCliente(parsed.data.cliente_id);
  res.json({
    produtos: produtos.map((p) => serialize(p, precos.precoEfetivo(p, mapa))),
  });
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
  const mapa = await precos.mapaPrecosDoCliente(parsed.data.cliente_id);
  res.json({
    produtos: produtos.map((p) => serialize(p, precos.precoEfetivo(p, mapa))),
  });
}

// ---- Admin ----

const produtoCreateSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  categoria: categoriaId.nullable(),
  descricao: z.string().optional(),
  preco: z.number().nonnegative(),
  unidadeMedida: unidadeEnum,
});

const produtoUpdateSchema = produtoCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export async function adminListar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    categoria: categoriaId.optional(),
    ativo: z.enum(['true', 'false']).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos' });
    return;
  }
  const produtos = await service.listCatalogo({
    categoriaId: parsed.data.categoria,
    ativo: parsed.data.ativo ? parsed.data.ativo === 'true' : undefined,
  });
  res.json({ produtos: produtos.map((p) => serialize(p)) });
}

export async function adminCriar(req: Request, res: Response): Promise<void> {
  const parsed = produtoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const { categoria, ...resto } = parsed.data;
    const produto = await service.criarProduto({ ...resto, categoriaId: categoria });
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
    const { categoria, ...resto } = parsed.data;
    const produto = await service.atualizarProduto(req.params.id, {
      ...resto,
      ...(categoria !== undefined ? { categoriaId: categoria } : {}),
    });
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
