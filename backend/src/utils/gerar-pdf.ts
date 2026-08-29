// Gera o PDF apresentável do pedido — para o vendedor entregar ao cliente.
import fs from 'node:fs';
import path from 'node:path';
import type PDFDocument from 'pdfkit';

/**
 * Logo da empresa, no canto superior esquerdo da PRIMEIRA página.
 *
 * É uma cópia em PNG de verdade: o arquivo do site (`frontend/public`) tem
 * extensão .png mas o conteúdo é WebP — o navegador aceita, o gerador de PDF
 * não. Se o arquivo sumir, o PDF cai no nome escrito e continua sendo gerado.
 */
const LOGO = path.resolve(__dirname, '../../assets/logo-gran-villar.png');
const LOGO_LARGURA = 110;
const LOGO_ALTURA = Math.round((LOGO_LARGURA * 270) / 505); // proporção original

export interface PedidoExport {
  numeroPedido: string | null;
  status: string;
  confirmadoEm: Date | null;
  criadoEm: Date;
  observacoes: string | null;
  total: number;
  subtotal: number;
  local: { codigo: string; nome: string; telefone: string | null };
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

// ---- Limites verticais da página A4 (841,89pt de altura) ----
/** Onde o conteúdo começa nas páginas seguintes à primeira. */
const TOPO = 50;
/** Altura do rodapé, fixa em todas as páginas. */
const RODAPE_Y = 775;
/**
 * Última altura utilizável pelo conteúdo. Abaixo disso começa a faixa
 * reservada ao rodapé — nada de item ou total pode invadi-la.
 */
const LIMITE_CONTEUDO = RODAPE_Y - 20;
/** Altura mínima de uma linha da tabela (nome de produto curto). */
const ALTURA_LINHA_MIN = 16;

export function desenharPedidoPdf(doc: PDFKit.PDFDocument, p: PedidoExport): void {
  const data = p.confirmadoEm ?? p.criadoEm;

  const ehRascunho = p.status === 'RASCUNHO';
  const statusLabel = ehRascunho
    ? 'Provisório'
    : p.status === 'CANCELADO'
      ? 'Cancelado'
      : 'Confirmado';

  // ---- Cabeçalho (desenhado uma vez, só na primeira página) ----
  // A logo à esquerda; se o arquivo faltar, escreve o nome no lugar dela.
  let baseEsquerda = 50 + LOGO_ALTURA;
  try {
    doc.image(LOGO, 50, 45, { width: LOGO_LARGURA });
    baseEsquerda = 45 + LOGO_ALTURA;
  } catch {
    doc.fillColor(ESCURO).font('Helvetica-Bold').fontSize(22).text('GRAN VILLAR', 50, 50);
    baseEsquerda = 78;
  }
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(CINZA)
    .text(ehRascunho ? 'Proposta de Pedido' : 'Pedido de Venda', 50, baseEsquerda + 6);

  // Dados do pedido à direita: número, data, vendedor e telefone da empresa.
  const direita = { x: 300, largura: 245 } as const;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(ESCURO);
  doc.text(p.numeroPedido ? `Pedido ${p.numeroPedido}` : 'Proposta', direita.x, 48, {
    width: direita.largura,
    align: 'right',
  });

  doc.font('Helvetica').fontSize(9.5).fillColor(CINZA);
  let yDir = 66;
  const linhaDireita = (texto: string) => {
    doc.text(texto, direita.x, yDir, { width: direita.largura, align: 'right' });
    yDir += 13;
  };
  linhaDireita(`Data: ${dataBR(data)}`);
  linhaDireita(`Vendedor: ${p.vendedor.nomeCompleto}`);
  // Telefone da empresa (filial), não o do vendedor. Some se não estiver
  // cadastrado, em vez de imprimir um rótulo vazio.
  if (p.local.telefone) linhaDireita(`Telefone: ${p.local.telefone}`);
  linhaDireita(`Status: ${statusLabel}`);

  // Linha divisória logo abaixo do mais alto dos dois blocos.
  const yLinha = Math.max(baseEsquerda + 22, yDir + 4);
  doc.moveTo(50, yLinha).lineTo(DIREITA, yLinha).strokeColor('#cbd5e1').stroke();

  // Dados do cliente (o vendedor agora aparece no cabeçalho, não repetir aqui)
  let y = yLinha + 15;
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
  doc.font('Helvetica-Bold').fillColor(ESCURO).text('FILIAL', 50, y);
  doc.font('Helvetica').fillColor(CINZA).text(`[${p.local.codigo}] ${p.local.nome}`, 120, y);
  y += 25;

  y = desenharCabecalhoTabela(doc, y);

  // Itens
  doc.font('Helvetica').fontSize(9).fillColor(ESCURO);
  for (const it of p.itens) {
    // Altura real da linha: nome de produto comprido quebra em duas linhas, e
    // avançar sempre 16 fazia a linha seguinte escrever por cima dela.
    const alturaNome = doc.heightOfString(it.produtoNome, { width: COL.produto.w });
    const alturaLinha = Math.max(ALTURA_LINHA_MIN, alturaNome + 5);

    if (y + alturaLinha > LIMITE_CONTEUDO) {
      doc.addPage();
      y = desenharCabecalhoTabela(doc, TOPO);
      doc.font('Helvetica').fontSize(9).fillColor(ESCURO);
    }

    doc.text(it.produtoCodigo, COL.cod.x, y, { width: COL.cod.w });
    doc.text(it.produtoNome, COL.produto.x, y, { width: COL.produto.w });
    doc.text(qtd(it.quantidade), COL.qtd.x, y, { width: COL.qtd.w, align: 'right' });
    doc.text(it.unidadeMedida, COL.un.x, y, { width: COL.un.w, align: 'center' });
    doc.text(moeda(it.precoUnitario), COL.unit.x, y, { width: COL.unit.w, align: 'right' });
    doc.text(moeda(it.subtotal), COL.sub.x, y, { width: COL.sub.w, align: 'right' });
    y += alturaLinha;
  }

  // Total — não pode ficar sozinho no pé da página, nem cair fora dela.
  if (y + 45 > LIMITE_CONTEUDO) {
    doc.addPage();
    y = TOPO;
  }
  doc.moveTo(330, y + 2).lineTo(DIREITA, y + 2).strokeColor('#cbd5e1').stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ESCURO);
  doc.text('TOTAL', 330, y, { width: 100 });
  doc.text(moeda(p.total), COL.sub.x - 60, y, { width: COL.sub.w + 60, align: 'right' });
  y += 30;

  // Observações
  const obs = p.observacoes?.trim();
  if (obs) {
    doc.font('Helvetica').fontSize(10);
    const alturaObs = doc.heightOfString(obs, { width: DIREITA - 50 }) + 25;
    if (y + alturaObs > LIMITE_CONTEUDO) {
      doc.addPage();
      y = TOPO;
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ESCURO).text('Observações', 50, y);
    doc.font('Helvetica').fontSize(10).fillColor(CINZA).text(obs, 50, y + 15, {
      width: DIREITA - 50,
    });
  }

  numerarPaginas(doc);
}

/**
 * Rodapé em todas as páginas, com "Página X de Y".
 *
 * Feito no fim porque só aqui se sabe o total de páginas. `switchToPage` volta
 * em cada uma para escrever no mesmo lugar — por isso o rodapé fica sempre na
 * mesma altura, e não colado ao fim do conteúdo.
 */
function numerarPaginas(doc: PDFKit.PDFDocument): void {
  const total = doc.bufferedPageRange().count;
  const rodape = `Documento gerado em ${dataBR(new Date())} — sem valor fiscal.`;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
    doc.text(rodape, 50, RODAPE_Y, { width: DIREITA - 50, align: 'center' });
    if (total > 1) {
      doc.text(`Página ${i + 1} de ${total}`, 50, RODAPE_Y + 11, {
        width: DIREITA - 50,
        align: 'center',
      });
    }
  }
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
