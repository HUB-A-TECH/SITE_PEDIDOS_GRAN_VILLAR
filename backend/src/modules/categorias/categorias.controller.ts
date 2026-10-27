import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './categorias.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

type CategoriaComTotal = Awaited<ReturnType<typeof service.listar>>[number];

function serialize(c: CategoriaComTotal) {
  return { id: c.id, nome: c.nome, ordem: c.ordem, totalProdutos: c._count.produtos };
}

const NOME_DUPLICADO = 'Já existe uma categoria com esse nome';
const nomeSchema = z.string().trim().min(1, 'Informe o nome da categoria').max(40);

/** Qualquer usuário logado: as telas de pedido e de produto usam a lista. */
export async function listar(_req: Request, res: Response): Promise<void> {
  const categorias = await service.listar();
  res.json({ categorias: categorias.map(serialize) });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ nome: nomeSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Informe o nome da categoria' });
    return;
  }
  try {
    res.status(201).json(serialize(await service.criar(parsed.data.nome)));
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: NOME_DUPLICADO });
      return;
    }
    throw e;
  }
}

export async function renomear(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ nome: nomeSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Informe o nome da categoria' });
    return;
  }
  try {
    res.json(serialize(await service.renomear(req.params.id, parsed.data.nome)));
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Categoria não encontrada' });
      return;
    }
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: NOME_DUPLICADO });
      return;
    }
    throw e;
  }
}

export async function reordenar(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ ids: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  await service.reordenar(parsed.data.ids);
  await listar(req, res);
}

/** Exclui; `destinoId` (opcional) recebe os produtos, senão ficam sem categoria. */
export async function excluir(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ destinoId: z.string().uuid().nullable().default(null) })
    .safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  const { destinoId } = parsed.data;
  if (destinoId === req.params.id) {
    res.status(400).json({ mensagem: 'Escolha outra categoria para os produtos' });
    return;
  }
  if (destinoId && !(await service.existe(destinoId))) {
    res.status(404).json({ mensagem: 'Categoria de destino não encontrada' });
    return;
  }
  try {
    await service.excluir(req.params.id, destinoId);
    res.json({ mensagem: 'Categoria excluída' });
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Categoria não encontrada' });
      return;
    }
    throw e;
  }
}
