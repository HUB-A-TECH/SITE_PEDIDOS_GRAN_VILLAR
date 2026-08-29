import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Cliente } from '@prisma/client';
import * as service from './clientes.service';
import * as historico from '../historico/historico.service';
import { isUniqueConstraintError, isNotFoundError } from '../../utils/prisma-errors';
import * as carteira from '../../lib/carteira';
import * as precos from '../precos/precos.service';

function serialize(c: Cliente) {
  return {
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    nomeFantasia: c.nomeFantasia,
    cnpj: c.cnpj,
    email: c.email,
    telefone: c.telefone,
    cep: c.cep,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    estado: c.estado,
    nomeComprador: c.nomeComprador,
    telefoneComprador: c.telefoneComprador,
    localId: c.localId,
    tabelaPrecoId: c.tabelaPrecoId,
    ativo: c.ativo,
  };
}

/** Versão do admin: inclui a tabela de preço e os vendedores responsáveis. */
function serializeCompleto(c: service.ClienteCompleto) {
  return {
    ...serialize(c),
    tabelaPreco: c.tabelaPreco,
    vendedores: c.vendedores.map((v) => v.vendedor),
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

  const apenasAtivos = parsed.data.ativos !== 'false';

  // Vendedor enxerga apenas os clientes da própria carteira (RN da carteira).
  if (req.user!.type === 'VENDEDOR') {
    const meus = await carteira.clientesDoUsuarioVendedor(req.user!.sub, apenasAtivos);
    res.json({ clientes: meus.map(serialize) });
    return;
  }

  // Admin: filtra por filial quando informada, senão lista todas.
  const clientes = parsed.data.local_id
    ? await service.listByLocal(parsed.data.local_id, apenasAtivos)
    : await service.listTodos(apenasAtivos);
  res.json({ clientes: clientes.map(serialize) });
}

// ---- Histórico (vendedor/admin) ----

/** Garante que o vendedor só acesse clientes da própria carteira. */
async function clienteAcessivel(
  req: Request,
  res: Response,
): Promise<Cliente | null> {
  const cliente = await service.getById(req.params.id);
  if (!cliente) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return null;
  }
  if (req.user!.type === 'VENDEDOR') {
    const atende = await carteira.vendedorAtendeCliente(req.user!.sub, cliente.id);
    if (!atende) {
      res.status(403).json({ mensagem: 'Cliente não está na sua carteira' });
      return null;
    }
  }
  return cliente;
}

export async function historicoCliente(req: Request, res: Response): Promise<void> {
  const cliente = await clienteAcessivel(req, res);
  if (!cliente) return;
  const limite = historico.parseLimite(req.query.limite);
  const pedidos = await historico.pedidosConfirmadosDoCliente(cliente.id, limite);
  res.json({
    historico: pedidos.map((p) => ({
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      data: p.confirmadoEm ?? p.criadoEm,
      total: Number(p.total),
      itens: p.itens.map((i) => ({
        codigo: i.produto.codigo,
        nome: i.produto.nome,
        quantidade: Number(i.quantidade),
        unidadeMedida: i.produto.unidadeMedida,
      })),
    })),
  });
}

export async function historicoItensCliente(
  req: Request,
  res: Response,
): Promise<void> {
  const cliente = await clienteAcessivel(req, res);
  if (!cliente) return;
  // Histórico por produto (últimas compras) para a tela de pedido.
  const historicoItens = await historico.historicoPorProduto(cliente.id);
  res.json({ historico: historicoItens });
}

// ---- Admin ----

const clienteCreateSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  // Endereço: o CEP guarda só os 8 dígitos; a UF em duas letras maiúsculas.
  cep: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos').optional(),
  logradouro: z.string().optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(80).optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().length(2, 'UF deve ter 2 letras').toUpperCase().optional(),
  nomeComprador: z.string().optional(),
  telefoneComprador: z.string().optional(),
  localId: z.string().uuid(),
  tabelaPrecoId: z.string().uuid().optional(),
  // Carteira: vendedores responsáveis por esse cliente.
  vendedorIds: z.array(z.string().uuid()).optional(),
});

const clienteUpdateSchema = clienteCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});

/** Valida tabela de preço e vendedores antes de gravar. Devolve erro ou null. */
async function validarVinculos(
  dados: { tabelaPrecoId?: string; vendedorIds?: string[] },
  localId: string,
): Promise<string | null> {
  if (dados.tabelaPrecoId) {
    const tabela = await service.tabelaExiste(dados.tabelaPrecoId);
    if (!tabela) return 'Tabela de preço não encontrada';
  }
  if (dados.vendedorIds && dados.vendedorIds.length > 0) {
    const total = await service.vendedoresExistemNoLocal(dados.vendedorIds, localId);
    if (total !== dados.vendedorIds.length) {
      return 'Um ou mais vendedores não pertencem a esta filial';
    }
  }
  return null;
}

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
  const clientes = await service.listByLocalCompleto(
    parsed.data.local_id,
    parsed.data.ativos !== 'false',
  );
  res.json({ clientes: clientes.map(serializeCompleto) });
}

export async function adminCriar(req: Request, res: Response): Promise<void> {
  const parsed = clienteCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Dados inválidos', erros: parsed.error.flatten() });
    return;
  }
  const { vendedorIds, ...dados } = parsed.data;
  const erro = await validarVinculos(parsed.data, dados.localId);
  if (erro) {
    res.status(400).json({ mensagem: erro });
    return;
  }
  try {
    const cliente = await service.criar(dados);
    if (vendedorIds) await service.definirVendedores(cliente.id, vendedorIds);
    const completo = await service.getByIdCompleto(cliente.id);
    res.status(201).json(completo ? serializeCompleto(completo) : serialize(cliente));
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
  const { vendedorIds, ...dados } = parsed.data;
  const atual = await service.getById(req.params.id);
  if (!atual) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  const erro = await validarVinculos(parsed.data, dados.localId ?? atual.localId);
  if (erro) {
    res.status(400).json({ mensagem: erro });
    return;
  }
  try {
    const cliente = await service.atualizar(req.params.id, dados);
    if (vendedorIds) await service.definirVendedores(cliente.id, vendedorIds);
    const completo = await service.getByIdCompleto(cliente.id);
    res.json(completo ? serializeCompleto(completo) : serialize(cliente));
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

/** Vendedores ativos de uma filial — opções do cadastro de cliente. */
export async function adminVendedores(req: Request, res: Response): Promise<void> {
  const parsed = z
    .object({ local_id: z.string().uuid() })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'local_id é obrigatório' });
    return;
  }
  const vendedores = await service.listVendedoresDoLocal(parsed.data.local_id);
  res.json({
    vendedores: vendedores.map((v) => ({ id: v.id, nomeCompleto: v.nomeCompleto })),
  });
}

// ---- Mix do cliente (admin) ----

export async function mixListar(req: Request, res: Response): Promise<void> {
  const cliente = await service.getByIdCompleto(req.params.id);
  if (!cliente) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  const mix = await service.listMix(req.params.id);
  // Preço mostrado no mix é o que o vendedor vai ver: o da tabela do cliente.
  const mapa = await precos.mapaPrecosDoCliente(cliente.id);
  res.json({
    tabelaPreco: cliente.tabelaPreco,
    produtos: mix.map((cp) => ({
      id: cp.produto.id,
      codigo: cp.produto.codigo,
      nome: cp.produto.nome,
      categoria: cp.produto.categoria,
      ativo: cp.produto.ativo,
      preco: precos.precoEfetivo(cp.produto, mapa),
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
