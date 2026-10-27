import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './setores.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';

type SetorComVinculos = NonNullable<Awaited<ReturnType<typeof service.getById>>>;

function serialize(s: SetorComVinculos) {
  return {
    id: s.id,
    nome: s.nome,
    cor: s.cor,
    ordem: s.ordem,
    localId: s.localId,
    vendedores: s.vendedores.map((v) => v.vendedor),
    totalClientes: s._count.clientes,
  };
}

const NOME_DUPLICADO = 'Já existe um setor com esse nome nesta filial';
const nomeSchema = z.string().trim().min(1, 'Informe o nome do setor').max(60);
// Cores dos cartões no Novo Pedido (o frontend tem a paleta de cada uma).
export const CORES_SETOR = ['VERMELHO', 'AMARELO', 'VERDE', 'AZUL', 'LARANJA', 'ROXO'] as const;
const corSchema = z.enum(CORES_SETOR, { message: 'Cor inválida' });

export async function listar(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ local_id: z.string().uuid() }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'local_id é obrigatório' });
    return;
  }
  const setores = await service.listar(parsed.data.local_id);
  res.json({ setores: setores.map(serialize) });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ nome: nomeSchema, localId: z.string().uuid(), cor: corSchema.default('AZUL') })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  try {
    const setor = await service.criar(parsed.data);
    res.status(201).json(serialize(setor));
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: NOME_DUPLICADO });
      return;
    }
    throw e;
  }
}

/**
 * Detalhe do setor + tudo que a tela precisa para montá-lo: os vendedores da
 * filial (para marcar quem atende) e os clientes da filial com o setor atual
 * de cada um (para colocar/tirar do setor).
 */
async function responderDetalhe(res: Response, setorId: string): Promise<void> {
  const setor = await service.getById(setorId);
  if (!setor) {
    res.status(404).json({ mensagem: 'Setor não encontrado' });
    return;
  }
  const [vendedoresFilial, clientes] = await Promise.all([
    service.vendedoresDaFilial(setor.localId),
    service.clientesDaFilial(setor.localId),
  ]);
  // Membros desativados não aparecem entre os ativos da filial, mas precisam
  // continuar na lista para o admin poder tirá-los do setor.
  const membros = setor.vendedores.map((v) => v.vendedor);
  const vendedores = [
    ...vendedoresFilial,
    ...membros.filter((m) => !vendedoresFilial.some((v) => v.id === m.id)),
  ];
  res.json({ setor: serialize(setor), vendedores, clientes });
}

export async function detalhe(req: Request, res: Response): Promise<void> {
  await responderDetalhe(res, req.params.id);
}

/** Muda o nome e/ou a cor do setor. */
export async function atualizar(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ nome: nomeSchema.optional(), cor: corSchema.optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Informe o nome e a cor do setor' });
    return;
  }
  try {
    const setor = await service.atualizar(req.params.id, parsed.data);
    res.json(serialize(setor));
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Setor não encontrado' });
      return;
    }
    if (isUniqueConstraintError(e)) {
      res.status(409).json({ mensagem: NOME_DUPLICADO });
      return;
    }
    throw e;
  }
}

/** Nova ordem dos cartões da filial: lista de ids na ordem desejada. */
export async function reordenar(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ localId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos' });
    return;
  }
  await service.reordenar(parsed.data.localId, parsed.data.ids);
  const setores = await service.listar(parsed.data.localId);
  res.json({ setores: setores.map(serialize) });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  try {
    await service.excluir(req.params.id);
    res.json({ mensagem: 'Setor excluído' });
  } catch (e) {
    if (isNotFoundError(e)) {
      res.status(404).json({ mensagem: 'Setor não encontrado' });
      return;
    }
    throw e;
  }
}

/** Confere que o setor existe e devolve a filial dele (ou responde 404). */
async function localDoSetor(res: Response, setorId: string): Promise<string | null> {
  const setor = await service.getById(setorId);
  if (!setor) {
    res.status(404).json({ mensagem: 'Setor não encontrado' });
    return null;
  }
  return setor.localId;
}

export async function adicionarVendedor(req: Request, res: Response): Promise<void> {
  const localId = await localDoSetor(res, req.params.id);
  if (!localId) return;
  const vendedor = await service.getVendedor(req.params.vendedorId);
  if (!vendedor) {
    res.status(404).json({ mensagem: 'Vendedor não encontrado' });
    return;
  }
  if (vendedor.localId !== localId) {
    res.status(400).json({ mensagem: 'Esse vendedor é de outra filial' });
    return;
  }
  await service.adicionarVendedor(req.params.id, vendedor.id);
  await responderDetalhe(res, req.params.id);
}

export async function removerVendedor(req: Request, res: Response): Promise<void> {
  const localId = await localDoSetor(res, req.params.id);
  if (!localId) return;
  await service.removerVendedor(req.params.id, req.params.vendedorId);
  await responderDetalhe(res, req.params.id);
}

export async function colocarCliente(req: Request, res: Response): Promise<void> {
  const localId = await localDoSetor(res, req.params.id);
  if (!localId) return;
  const cliente = await service.getCliente(req.params.clienteId);
  if (!cliente) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  if (cliente.localId !== localId) {
    res.status(400).json({ mensagem: 'Esse cliente é de outra filial' });
    return;
  }
  await service.colocarCliente(req.params.id, cliente.id);
  await responderDetalhe(res, req.params.id);
}

export async function tirarCliente(req: Request, res: Response): Promise<void> {
  const localId = await localDoSetor(res, req.params.id);
  if (!localId) return;
  await service.tirarCliente(req.params.id, req.params.clienteId);
  await responderDetalhe(res, req.params.id);
}
