// Gera o PDF apresentável do pedido — para o vendedor entregar ao cliente.
import type PDFDocument from 'pdfkit';

export interface PedidoExport {
  numeroPedido: string | null;
  status: string;
  confirmadoEm: Date | null;
  criadoEm: Date;
  observacoes: string | null;
  total: number;
  subtotal: number;
  local: { codigo: string; nome: string };
  vendedor: { nomeCompleto: string };
  cliente: {
    codigo: string;
    nome: string;
    nomeFantasia: string | null;
    cnpj: string | null;
  };
  itens: {
    produtoCodigo: string;
    produtoNome: string;
    unidadeMedida: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
  }[];
}

const moeda = (v: number) =>
  'R$ ' +
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qtd = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const dataBR = (d: Date) => d.toLocaleDateString('pt-BR');

const CINZA = '#475569';
const ESCURO = '#1e293b';

// Colunas da tabela (x inicial e largura).
const COL = {
  cod: { x: 50, w: 55 },
  produto: { x: 105, w: 225 },
  qtd: { x: 330, w: 45 },
  un: { x: 375, w: 35 },
  unit: { x: 410, w: 65 },
  sub: { x: 475, w: 70 },
};
const DIREITA = 545;

export function desenharPedidoPdf(doc: PDFKit.PDFDocument, p: PedidoExport): void {
  const data = p.confirmadoEm ?? p.criadoEm;

  const ehRascunho = p.status === 'RASCUNHO';
  const statusLabel = ehRascunho
    ? 'Provisório'
    : p.status === 'CANCELADO'
      ? 'Cancelado'
      : 'Confirmado';

  // Cabeçalho
  doc.fillColor(ESCURO).font('Helvetica-Bold').fontSize(22).text('GRAN VILLAR', 50, 50);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(CINZA)
    .text(ehRascunho ? 'Proposta de Pedido' : 'Pedido de Venda', 50, 76);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(ESCURO);
  doc.text(p.numeroPedido ? `Pedido ${p.numeroPedido}` : 'Proposta', 300, 50, {
    width: 245,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(10).fillColor(CINZA);
  doc.text(`Data: ${dataBR(data)}`, 300, 68, { width: 245, align: 'right' });
  doc.text(`Status: ${statusLabel}`, 300, 82, { width: 245, align: 'right' });

  // Linha divisória
  doc.moveTo(50, 105).lineTo(DIREITA, 105).strokeColor('#cbd5e1').stroke();

  // Dados do cliente / vendedor
  let y = 120;
  const fantasia = p.cliente.nomeFantasia ? ` (${p.cliente.nomeFantasia})` : '';
  doc.fillColor(ESCURO).font('Helvetica-Bold').fontSize(10).text('CLIENTE', 50, y);
  doc.font('Helvetica').fillColor(CINZA);
  doc.text(`[${p.cliente.codigo}] ${p.cliente.nome}${fantasia}`, 120, y);
  y += 15;
  if (p.cliente.cnpj) {
    doc.font('Helvetica-Bold').fillColor(ESCURO).text('CNPJ', 50, y);
    doc.font('Helvetica').fillColor(CINZA).text(p.cliente.cnpj, 120, y);
    y += 15;
  }
  doc.font('Helvetica-Bold').fillColor(ESCURO).text('VENDEDOR', 50, y);
  doc.font('Helvetica').fillColor(CINZA).text(p.vendedor.nomeCompleto, 120, y);
  y += 15;
  doc.font('Helvetica-Bold').fillColor(ESCURO).text('FILIAL', 50, y);
  doc.font('Helvetica').fillColor(CINZA).text(`[${p.local.codigo}] ${p.local.nome}`, 120, y);
  y += 25;

  y = desenharCabecalhoTabela(doc, y);

  // Itens
  doc.font('Helvetica').fontSize(9).fillColor(ESCURO);
  for (const it of p.itens) {
    if (y > 760) {
      doc.addPage();
      y = 50;
      y = desenharCabecalhoTabela(doc, y);
      doc.font('Helvetica').fontSize(9).fillColor(ESCURO);
    }
    doc.text(it.produtoCodigo, COL.cod.x, y, { width: COL.cod.w });
    doc.text(it.produtoNome, COL.produto.x, y, { width: COL.produto.w });
    doc.text(qtd(it.quantidade), COL.qtd.x, y, { width: COL.qtd.w, align: 'right' });
    doc.text(it.unidadeMedida, COL.un.x, y, { width: COL.un.w, align: 'center' });
    doc.text(moeda(it.precoUnitario), COL.unit.x, y, { width: COL.unit.w, align: 'right' });
    doc.text(moeda(it.subtotal), COL.sub.x, y, { width: COL.sub.w, align: 'right' });
    y += 16;
  }

  // Total
  doc.moveTo(330, y + 2).lineTo(DIREITA, y + 2).strokeColor('#cbd5e1').stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ESCURO);
  doc.text('TOTAL', 330, y, { width: 100 });
  doc.text(moeda(p.total), COL.sub.x - 60, y, { width: COL.sub.w + 60, align: 'right' });
  y += 30;

  // Observações
  if (p.observacoes && p.observacoes.trim()) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ESCURO).text('Observações', 50, y);
    doc.font('Helvetica').fontSize(10).fillColor(CINZA).text(p.observacoes.trim(), 50, y + 15, {
      width: DIREITA - 50,
    });
    y = doc.y + 10;
  }

  // Rodapé (logo após o conteúdo, para não gerar página em branco)
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(
      `Documento gerado em ${dataBR(new Date())} — sem valor fiscal.`,
      50,
      y + 20,
      { width: DIREITA - 50, align: 'center' },
    );
}

function desenharCabecalhoTabela(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(50, y - 2, DIREITA - 50, 18).fill('#e2e8f0');
  doc.fillColor(ESCURO).font('Helvetica-Bold').fontSize(9);
  doc.text('CÓD', COL.cod.x, y + 2, { width: COL.cod.w });
  doc.text('PRODUTO', COL.produto.x, y + 2, { width: COL.produto.w });
  doc.text('QTD', COL.qtd.x, y + 2, { width: COL.qtd.w, align: 'right' });
  doc.text('UN', COL.un.x, y + 2, { width: COL.un.w, align: 'center' });
  doc.text('UNIT', COL.unit.x, y + 2, { width: COL.unit.w, align: 'right' });
  doc.text('SUBTOTAL', COL.sub.x, y + 2, { width: COL.sub.w, align: 'right' });
  return y + 24;
}
