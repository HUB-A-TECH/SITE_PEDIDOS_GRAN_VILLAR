import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Vendedor } from '@prisma/client';
import * as service from './pedidos.service';
import * as historico from '../historico/historico.service';
import { isUniqueConstraintError } from '../../utils/prisma-errors';
import PDFDocument from 'pdfkit';
import { gerarTxtPedido } from '../../utils/gerar-txt';
import { desenharPedidoPdf } from '../../utils/gerar-pdf';

const JANELA_CANCELAMENTO_MS = 24 * 60 * 60 * 1000; // 1 dia (RN-08)

type PedidoComItens = NonNullable<
  Awaited<ReturnType<typeof service.getRascunhoAtual>>
>;

function serialize(p: PedidoComItens) {
  return {
    id: p.id,
    clienteId: p.clienteId,
    status: p.status,
    observacoes: p.observacoes,
    subtotal: Number(p.subtotal),
    total: Number(p.total),
    cliente: {
      id: p.cliente.id,
      codigo: p.cliente.codigo,
      nome: p.cliente.nome,
    },
    itens: p.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      produto: {
        codigo: i.produto.codigo,
        nome: i.produto.nome,
        categoria: i.produto.categoria,
        unidadeMedida: i.produto.unidadeMedida,
      },
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      subtotal: Number(i.subtotal),
    })),
  };
}

/** Garante que o usuário é um vendedor ativo; devolve o registro Vendedor. */
async function exigirVendedor(
  req: Request,
  res: Response,
): Promise<Vendedor | null> {
  if (req.user!.type !== 'VENDEDOR') {
    res.status(403).json({ mensagem: 'Apenas vendedores podem criar pedidos' });
    return null;
  }
  const vendedor = await service.getVendedorByUsuario(req.user!.sub);
  if (!vendedor || !vendedor.ativo) {
    res.status(403).json({ mensagem: 'Vendedor não encontrado ou inativo' });
    return null;
  }
  return vendedor;
}

/** Carrega o pedido garantindo que pertence ao vendedor e é rascunho. */
async function carregarRascunho(
  pedidoId: string,
  vendedorId: string,
  res: Response,
): Promise<PedidoComItens | null> {
  const pedido = await service.getPedidoDoVendedor(pedidoId, vendedorId);
  if (!pedido) {
    res.status(404).json({ mensagem: 'Pedido não encontrado' });
    return null;
  }
  if (pedido.status !== 'RASCUNHO') {
    res.status(409).json({ mensagem: 'O pedido não é mais um rascunho' });
    return null;
  }
  return pedido;
}

async function responderPedidoAtualizado(
  pedidoId: string,
  vendedorId: string,
  res: Response,
): Promise<void> {
  await service.recomputarTotais(pedidoId);
  const atualizado = await service.getPedidoDoVendedor(pedidoId, vendedorId);
  res.json({ pedido: atualizado ? serialize(atualizado) : null });
}

export async function meuHistorico(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const periodo = historico.normalizarPeriodo(req.query.periodo);
  const pedidos = await historico.meusPedidos(vendedor.id, periodo);
  res.json({
    periodo,
    pedidos: pedidos.map((p) => ({
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      cliente: p.cliente,
      data: p.confirmadoEm ?? p.criadoEm,
      total: Number(p.total),
      status: p.status,
      itensCount: p._count.itens,
    })),
  });
}

export async function obterRascunho(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const rascunho = await service.getRascunhoAtual(vendedor.id);
  res.json({ pedido: rascunho ? serialize(rascunho) : null });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;

  const parsed = z
    .object({ cliente_id: z.string().uuid() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'cliente_id é obrigatório' });
    return;
  }

  // Um rascunho por vendedor (RN-04).
  const existente = await service.getRascunhoAtual(vendedor.id);
  if (existente) {
    res.status(409).json({
      mensagem: 'Já existe um rascunho em andamento',
      rascunho: serialize(existente),
    });
    return;
  }

  const cliente = await service.getCliente(parsed.data.cliente_id);
  if (!cliente || !cliente.ativo) {
    res.status(404).json({ mensagem: 'Cliente não encontrado' });
    return;
  }
  if (cliente.localId !== vendedor.localId) {
    res.status(403).json({ mensagem: 'Cliente pertence a outro local' });
    return;
  }

  try {
    const pedido = await service.criarRascunho(
      vendedor.id,
      vendedor.localId,
      cliente.id,
    );
    res.status(201).json({ pedido: serialize(pedido) });
  } catch (e) {
    // Corrida: a restrição única do banco barrou um segundo rascunho.
    if (isUniqueConstraintError(e)) {
      const atual = await service.getRascunhoAtual(vendedor.id);
      res.status(409).json({
        mensagem: 'Já existe um rascunho em andamento',
        rascunho: atual ? serialize(atual) : null,
      });
      return;
    }
    throw e;
  }
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;
  await service.excluirPedido(pedido.id);
  res.json({ mensagem: 'Rascunho descartado' });
}

export async function adicionarItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({
      produto_id: z.string().uuid(),
      quantidade: z.number().positive(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'produto_id e quantidade (> 0) são obrigatórios' });
    return;
  }

  const noMix = await service.produtoNoMix(pedido.clienteId, parsed.data.produto_id);
  if (!noMix) {
    res.status(400).json({ mensagem: 'Produto não está no mix deste cliente' });
    return;
  }
  const produto = await service.getProduto(parsed.data.produto_id);
  if (!produto || !produto.ativo) {
    res.status(404).json({ mensagem: 'Produto não encontrado' });
    return;
  }

  await service.definirItem(pedido.id, produto, parsed.data.quantidade);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

const loteSchema = z.object({
  itens: z
    .array(
      z.object({
        produto_id: z.string().uuid(),
        quantidade: z.number().positive(),
      }),
    )
    .min(1)
    .max(300),
});

export async function adicionarItensLote(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = loteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Lista de itens inválida' });
    return;
  }

  await service.definirItensEmLote(
    pedido.id,
    pedido.clienteId,
    parsed.data.itens.map((i) => ({ produtoId: i.produto_id, quantidade: i.quantidade })),
  );
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function atualizarItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({ quantidade: z.number().positive() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'quantidade (> 0) é obrigatória' });
    return;
  }

  const item = await service.getItem(req.params.itemId);
  if (!item || item.pedidoId !== pedido.id) {
    res.status(404).json({ mensagem: 'Item não encontrado no pedido' });
    return;
  }

  await service.atualizarQuantidadeItem(item, parsed.data.quantidade);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function removerItem(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const item = await service.getItem(req.params.itemId);
  if (!item || item.pedidoId !== pedido.id) {
    res.status(404).json({ mensagem: 'Item não encontrado no pedido' });
    return;
  }

  await service.excluirItem(item.id);
  await responderPedidoAtualizado(pedido.id, vendedor.id, res);
}

export async function atualizarObservacoes(
  req: Request,
  res: Response,
): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const parsed = z
    .object({ observacoes: z.string().max(1000) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'observacoes inválidas' });
    return;
  }

  await service.atualizarObservacoes(pedido.id, parsed.data.observacoes);
  const atualizado = await service.getPedidoDoVendedor(pedido.id, vendedor.id);
  res.json({ pedido: atualizado ? serialize(atualizado) : null });
}

export async function confirmar(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;
  const pedido = await carregarRascunho(req.params.id, vendedor.id, res);
  if (!pedido) return;

  const totalItens = await service.contarItens(pedido.id);
  if (totalItens === 0) {
    res.status(400).json({ mensagem: 'Não é possível enviar um pedido sem itens' });
    return;
  }

  const numero = await service.confirmarPedido(pedido.id);
  res.json({
    pedidoId: pedido.id,
    numeroPedido: numero,
    status: 'CONFIRMADO',
    txtDisponivel: true,
  });
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const vendedor = await exigirVendedor(req, res);
  if (!vendedor) return;

  const pedido = await service.getPedidoDoVendedor(req.params.id, vendedor.id);
  if (!pedido) {
    res.status(404).json({ mensagem: 'Pedido não encontrado' });
    return;
  }
  if (pedido.status !== 'CONFIRMADO') {
    res.status(409).json({ mensagem: 'Apenas pedidos confirmados podem ser cancelados' });
    return;
  }
  // Janela de 1 dia para o vendedor cancelar sozinho (RN-08).
  const confirmadoEm = pedido.confirmadoEm?.getTime() ?? 0;
  if (Date.now() - confirmadoEm > JANELA_CANCELAMENTO_MS) {
    res.status(403).json({
      mensagem: 'Prazo de cancelamento (1 dia) expirado. Solicite a um administrador.',
    });
    return;
  }

  const parsed = z
    .object({ motivo: z.string().max(500).optional() })
    .safeParse(req.body ?? {});
  const motivo = parsed.success ? (parsed.data.motivo ?? null) : null;

  await service.cancelarPedido(pedido.id, motivo);
  res.json({ pedidoId: pedido.id, status: 'CANCELADO' });
}

type PedidoCompleto = NonNullable<
  Awaited<ReturnType<typeof service.getPedidoCompleto>>
>;

/** Carrega o pedido para exportação (TXT/PDF), aplicando escopo e validações. */
async function carregarExportavel(
  req: Request,
  res: Response,
): Promise<PedidoCompleto | null> {
  const isAdmin = req.user!.type !== 'VENDEDOR';
  const pedido = await service.getPedidoCompleto(req.params.id);
  if (!pedido) {
    res.status(404).json({ mensagem: 'Pedido não encontrado' });
    return null;
  }
  if (!isAdmin) {
    const vendedor = await service.getVendedorByUsuario(req.user!.sub);
    if (!vendedor || pedido.vendedorId !== vendedor.id) {
      res.status(404).json({ mensagem: 'Pedido não encontrado' });
      return null;
    }
  } else if (pedido.status === 'RASCUNHO') {
    // A administração só enxerga pedidos enviados (rascunho é do vendedor).
    res.status(404).json({ mensagem: 'Pedido não encontrado' });
    return null;
  }
  return pedido;
}

function dadosExport(pedido: PedidoCompleto) {
  return {
    numeroPedido: pedido.numeroPedido,
    status: pedido.status,
    confirmadoEm: pedido.confirmadoEm,
    criadoEm: pedido.criadoEm,
    observacoes: pedido.observacoes,
    total: Number(pedido.total),
    subtotal: Number(pedido.subtotal),
    local: pedido.local,
    vendedor: pedido.vendedor,
    cliente: pedido.cliente,
    itens: pedido.itens.map((i) => ({
      produtoCodigo: i.produto.codigo,
      produtoNome: i.produto.nome,
      unidadeMedida: i.produto.unidadeMedida,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      subtotal: Number(i.subtotal),
    })),
  };
}

export async function baixarTxt(req: Request, res: Response): Promise<void> {
  const pedido = await carregarExportavel(req, res);
  if (!pedido) return;
  const txt = gerarTxtPedido(dadosExport(pedido));
  const nome = pedido.numeroPedido
    ? `pedido_${pedido.numeroPedido}.txt`
    : `proposta_${pedido.id.slice(0, 8)}.txt`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.send(txt);
}

export async function baixarPdf(req: Request, res: Response): Promise<void> {
  const pedido = await carregarExportavel(req, res);
  if (!pedido) return;
  const nome = pedido.numeroPedido
    ? `pedido_${pedido.numeroPedido}.pdf`
    : `proposta_${pedido.id.slice(0, 8)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  desenharPedidoPdf(doc, dadosExport(pedido));
  doc.end();
}

export async function adminListar(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    periodo: z.string().optional(),
    vendedor_id: z.string().uuid().optional(),
    cliente_id: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ mensagem: 'Parâmetros inválidos' });
    return;
  }
  const pedidos = await service.listarPedidosAdmin({
    meses: historico.normalizarPeriodo(parsed.data.periodo),
    vendedorId: parsed.data.vendedor_id,
    clienteId: parsed.data.cliente_id,
  });
  res.json({
    pedidos: pedidos.map((p) => ({
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      cliente: p.cliente,
      vendedor: p.vendedor,
      data: p.confirmadoEm ?? p.criadoEm,
      total: Number(p.total),
      status: p.status,
      itensCount: p._count.itens,
    })),
  });
}
