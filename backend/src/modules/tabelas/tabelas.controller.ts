import type { Request, Response } from 'express';
import { z } from 'zod';
import type { TabelaPreco } from '@prisma/client';
import * as service from './tabelas.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

function serialize(t: TabelaPreco & { _count?: { clientes: number } }) {
  return {
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    ativo: t.ativo,
    ...(t._count ? { totalClientes: t._count.clientes } : {}),
  };
}

export async function listar(req: Request, res: Response): Promise<void> {
  const tabelas = await service.listar(req.query.ativas !== 'false');
  res.json({ tabelas: tabelas.map(serialize) });
}

const criarSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  // Quando informado, a tabela nova nasce com os preços desta outra.
  duplicarDe: z.string().uuid().optional(),
});

export async function criar(req: Request, res: Response): Promise<void> {
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  const { duplicarDe, ...dados } = parsed.data;
  try {
    if (duplicarDe) {
      const origem = await service.getById(duplicarDe);
      if (!origem) {
        res.status(404).json({ mensagem: 'Tabela de origem não encontrada' });
        return;
      }
      const nova = await service.duplicar(duplicarDe, dados);
      res.status(201).json(serialize(nova));
      return;
    }
    const tabela = await service.criar(dados);
    res.status(201).json(serialize(tabela));
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe uma tabela com esse nome' });
      return;
    }
    throw e;
  }
}

const atualizarSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional(),
  ativo: z.boolean().optional(),
});

export async function atualizar(req: Request, res: Response): Promise<void> {
  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const tabela = await service.atualizar(req.params.id, parsed.data);
    res.json(serialize(tabela));
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Tabela não encontrada' });
      return;
    }
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: 'Já existe uma tabela com esse nome' });
      return;
    }
    throw e;
  }
}

/** Detalhe: a tabela + os 125 produtos com o preço que vale nela. */
export async function detalhe(req: Request, res: Response): Promise<void> {
  const tabela = await service.getById(req.params.id);
  if (!tabela) {
    res.status(404).json({ mensagem: 'Tabela não encontrada' });
    return;
  }
  const produtos = await service.listarProdutosDaTabela(tabela.id);
  const clientes = await service.clientesDaTabela(tabela.id);
  res.json({
    tabela: serialize(tabela),
    clientes,
    produtos: produtos.map((p) => {
      const item = p.tabelaPrecoItens[0];
      return {
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        categoria: p.categoriaId,
        unidadeMedida: p.unidadeMedida,
        preco: item ? Number(item.preco) : Number(p.preco),
        precoCatalogo: Number(p.preco),
        // false = a tabela não tem preço próprio e está herdando o do catálogo.
        definido: Boolean(item),
      };
    }),
  });
}

export async function definirPreco(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ preco: z.number().nonnegative() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'preco deve ser um número maior ou igual a zero' });
    return;
  }
  const tabela = await service.getById(req.params.id);
  if (!tabela) {
    res.status(404).json({ mensagem: 'Tabela não encontrada' });
    return;
  }
  const produto = await service.produtoExiste(req.params.produtoId);
  if (!produto) {
    res.status(404).json({ mensagem: 'Produto não encontrado' });
    return;
  }
  await service.definirPreco(tabela.id, produto.id, parsed.data.preco);
  res.json({
    tabelaId: tabela.id,
    produtoId: produto.id,
    preco: parsed.data.preco,
  });
}
