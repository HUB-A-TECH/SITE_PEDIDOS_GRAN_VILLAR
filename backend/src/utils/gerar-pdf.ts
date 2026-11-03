// Gera o PDF do pedido — vai para o cliente e para quem separa o pedido.
// Layout enxuto: cabeçalho compacto e tabela de linhas baixas, para caber o
// máximo de produtos por folha (cerca de 50 numa A4).
import path from 'node:path';

/**
 * Logo da Gran Villar, no canto direito do cabeçalho.
 *
 * É uma cópia em PNG de verdade: o arquivo do site (`frontend/public`) tem
 * extensão .png mas o conteúdo é WebP — o navegador aceita, o gerador de PDF
 * não. Se o arquivo sumir, o PDF escreve o nome no lugar e continua sendo gerado.
 */
const LOGO = path.resolve(__dirname, '../../assets/logo-gran-villar.png');
const LOGO_LARGURA = 72;
const LOGO_ALTURA = (LOGO_LARGURA * 270) / 505; // proporção original

/** Empresa que vende (os produtos são da marca Gran Villar). */
const EMPRESA = 'PORTOBELO';
const EMPRESA_RAZAO = 'Comércio de Produtos Alimentícios LTDA.';

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

// Cores do site (tailwind.config.js do frontend).
const VERDE = '#1a8735'; // brand-600
const VERDE_ESCURO = '#166d2c'; // brand-700
const AMARELO_TEXTO = '#8a6d00'; // brandYellow-700
const VERMELHO = '#c51f12'; // brandRed-600
const ESCURO = '#1e293b';
const CINZA = '#64748b';
const LINHA = '#d4dbd6';
const ZEBRA = '#f3f6f4';

// ---- Página A4 (595,28 × 841,89pt) ----
const MARGEM = 20;
const LARGURA = 595.28 - MARGEM * 2;
const DIREITA = MARGEM + LARGURA;
/** Última altura utilizável pelo conteúdo; abaixo fica só o "Página X de Y". */
const LIMITE_CONTEUDO = 818;
const PAGINA_Y = 826;

// Colunas da tabela, da esquerda para a direita (larguras somam LARGURA).
const COLUNAS = [
  { chave: 'cod', titulo: 'CÓD.', w: 48, align: 'center' },
  { chave: 'produto', titulo: 'PRODUTO', w: LARGURA - 48 - 40 - 80 - 90, align: 'left' },
  { chave: 'qtd', titulo: 'QTD.', w: 40, align: 'center' },
  { chave: 'unit', titulo: 'PREÇO UNIT.', w: 80, align: 'right' },
  { chave: 'total', titulo: 'TOTAL', w: 90, align: 'right' },
] as const;
type Chave = (typeof COLUNAS)[number]['chave'];

const ALTURA_CAB_TABELA = 16;
const ALTURA_TOTAL = 22;
/** Altura mínima de uma linha (nome de produto curto). */
const ALTURA_LINHA_MIN = 13;
const FONTE_LINHA = 8.5;
const PAD = 5;

export function desenharPedidoPdf(doc: PDFKit.PDFDocument, p: PedidoExport): void {
  let y = desenharCabecalho(doc, p) + 8;
  y = desenharCabecalhoTabela(doc, y);

  p.itens.forEach((it, i) => {
    doc.font('Helvetica').fontSize(FONTE_LINHA);
    const largProduto = COLUNAS[1].w - PAD * 2;
    const alturaNome = doc.heightOfString(it.produtoNome, { width: largProduto });
    const altura = Math.max(ALTURA_LINHA_MIN, alturaNome + 3);

    if (y + altura > LIMITE_CONTEUDO) {
      doc.addPage();
      y = desenharCabecalhoTabela(doc, desenharCabecalhoContinuacao(doc, p));
    }

    desenharLinha(
      doc,
      y,
      altura,
      {
        cod: it.produtoCodigo,
        produto: it.produtoNome,
        qtd: qtd(it.quantidade),
        unit: moeda(it.precoUnitario),
        total: moeda(it.subtotal),
      },
      i % 2 === 1,
    );
    y += altura;
  });

  // ---- Total e observações, logo abaixo da tabela ----
  const obs = p.observacoes?.trim() ?? '';
  doc.font('Helvetica').fontSize(8.5);
  const largObs = LARGURA - 90;
  const alturaObs = Math.max(20, obs ? doc.heightOfString(obs, { width: largObs }) + 9 : 0);
  const alturaRodape = 4 + ALTURA_TOTAL + 4 + alturaObs;
  if (y + alturaRodape > LIMITE_CONTEUDO) {
    doc.addPage();
    y = desenharCabecalhoContinuacao(doc, p) - 4;
  }
  y += 4;
  desenharTotal(doc, y, p);
  y += ALTURA_TOTAL + 4;
  desenharObservacoes(doc, y, alturaObs, obs, largObs);

  numerarPaginas(doc);
}

/** Cabeçalho completo (só na primeira página). Devolve onde ele termina. */
function desenharCabecalho(doc: PDFKit.PDFDocument, p: PedidoExport): number {
  const topo = MARGEM;
  const altura = 72;
  doc
    .roundedRect(MARGEM, topo, LARGURA, altura, 6)
    .lineWidth(1)
    .strokeColor(VERDE)
    .stroke();

  // Empresa e cliente, à esquerda.
  const xEsq = MARGEM + 12;
  const largEsq = 205;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(VERDE_ESCURO);
  doc.text(EMPRESA, xEsq, topo + 8, { width: largEsq, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(ESCURO);
  doc.text(EMPRESA_RAZAO, xEsq, topo + 23, { width: largEsq, lineBreak: false });

  const fantasia = p.cliente.nomeFantasia?.trim();
  const principal = fantasia || p.cliente.nome;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(ESCURO);
  doc.text(principal, xEsq, topo + 35, { width: largEsq, lineBreak: false, ellipsis: true });
  if (fantasia && fantasia !== p.cliente.nome) {
    doc.font('Helvetica').fontSize(9).fillColor(CINZA);
    doc.text(p.cliente.nome, xEsq, topo + 54, {
      width: largEsq,
      lineBreak: false,
      ellipsis: true,
    });
  }

  // Código do cliente.
  const xCod = 240;
  const largCod = 60;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CINZA);
  doc.text('COD CLT', xCod, topo + 31, { width: largCod, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ESCURO);
  doc.text(p.cliente.codigo, xCod, topo + 42, {
    width: largCod,
    align: 'center',
    lineBreak: false,
  });

  // Número e data do pedido.
  const xPed = 312;
  const xValor = 380;
  const campo = (rotulo: string, valor: string, yy: number) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(CINZA);
    doc.text(rotulo, xPed, yy + 1, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(ESCURO);
    doc.text(valor, xValor, yy, { width: 85, lineBreak: false });
  };
  campo('Nº do Pedido:', p.numeroPedido ?? 'Proposta', topo + 25);
  campo('Data do Pedido:', dataBR(p.confirmadoEm ?? p.criadoEm), topo + 41);

  // Aviso só quando o pedido NÃO deve ser separado.
  const aviso =
    p.status === 'RASCUNHO'
      ? { texto: 'PROVISÓRIO — não confirmado', cor: AMARELO_TEXTO }
      : p.status === 'CANCELADO'
        ? { texto: 'PEDIDO CANCELADO', cor: VERMELHO }
        : null;
  if (aviso) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(aviso.cor);
    doc.text(aviso.texto, xPed, topo + 56, { width: 150, lineBreak: false });
  }

  // Logo, vendedor e telefone da empresa, à direita.
  const largDir = 108;
  const xDir = DIREITA - 12 - largDir;
  try {
    doc.image(LOGO, xDir + (largDir - LOGO_LARGURA) / 2, topo + 4, { width: LOGO_LARGURA });
  } catch {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(VERDE_ESCURO);
    doc.text('Gran Villar', xDir, topo + 18, { width: largDir, align: 'center' });
  }
  doc.fontSize(8).fillColor(ESCURO).font('Helvetica-Bold');
  const rotuloVend = 'Vendedor: ';
  const largRotulo = doc.widthOfString(rotuloVend);
  doc.text(rotuloVend, xDir, topo + 50, { lineBreak: false });
  doc.font('Helvetica').text(p.vendedor.nomeCompleto, xDir + largRotulo, topo + 50, {
    width: largDir - largRotulo,
    lineBreak: false,
    ellipsis: true,
  });
  // Telefone da empresa (filial), não o do vendedor; some se não cadastrado.
  if (p.local.telefone) {
    doc.font('Helvetica').fontSize(8).fillColor(ESCURO);
    doc.text(`Tel.: ${p.local.telefone}`, xDir, topo + 60, { width: largDir, lineBreak: false });
  }

  return topo + altura;
}

/** Nas páginas seguintes: uma linha só identificando o pedido. */
function desenharCabecalhoContinuacao(doc: PDFKit.PDFDocument, p: PedidoExport): number {
  const nome = p.cliente.nomeFantasia?.trim() || p.cliente.nome;
  const numero = p.numeroPedido ? `Pedido ${p.numeroPedido}` : 'Proposta';
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERDE_ESCURO);
  doc.text(`${numero}  ·  ${nome}  ·  COD CLT ${p.cliente.codigo}  (continuação)`, MARGEM, MARGEM, {
    width: LARGURA,
    lineBreak: false,
    ellipsis: true,
  });
  return MARGEM + 16;
}

function desenharCabecalhoTabela(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(MARGEM, y, LARGURA, ALTURA_CAB_TABELA).fill(VERDE_ESCURO);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
  let x = MARGEM;
  for (const c of COLUNAS) {
    doc.text(c.titulo, x + PAD, y + 4.5, {
      width: c.w - PAD * 2,
      align: c.align === 'left' ? 'left' : 'center',
      lineBreak: false,
    });
    x += c.w;
  }
  return y + ALTURA_CAB_TABELA;
}

function desenharLinha(
  doc: PDFKit.PDFDocument,
  y: number,
  altura: number,
  valores: Record<Chave, string>,
  zebra: boolean,
): void {
  if (zebra) doc.rect(MARGEM, y, LARGURA, altura).fill(ZEBRA);

  // Grade fina: borda da linha e divisões das colunas.
  doc.lineWidth(0.5).strokeColor(LINHA);
  doc.rect(MARGEM, y, LARGURA, altura).stroke();
  let x = MARGEM;
  for (const c of COLUNAS.slice(0, -1)) {
    x += c.w;
    doc.moveTo(x, y).lineTo(x, y + altura).stroke();
  }

  x = MARGEM;
  const yTexto = y + (ALTURA_LINHA_MIN - FONTE_LINHA) / 2 + 0.5;
  for (const c of COLUNAS) {
    // Quantidade em negrito: é o número que quem separa mais procura.
    doc
      .font(c.chave === 'qtd' ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(FONTE_LINHA)
      .fillColor(ESCURO);
    doc.text(valores[c.chave], x + PAD, yTexto, {
      width: c.w - PAD * 2,
      align: c.align,
      lineBreak: c.chave === 'produto',
    });
    x += c.w;
  }
}

function desenharTotal(doc: PDFKit.PDFDocument, y: number, p: PedidoExport): void {
  const altura = ALTURA_TOTAL;
  const largValor = 130;
  doc.lineWidth(1).strokeColor(VERDE_ESCURO);
  doc.rect(MARGEM, y, LARGURA, altura).stroke();
  doc.rect(DIREITA - largValor, y, largValor, altura).fill(VERDE_ESCURO);

  const qtdItens = p.itens.length;
  doc.font('Helvetica').fontSize(8.5).fillColor(CINZA);
  doc.text(`${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}`, MARGEM + 10, y + 7, {
    lineBreak: false,
  });

  doc.font('Helvetica-Bold').fontSize(11).fillColor(ESCURO);
  doc.text('TOTAL DO PEDIDO', MARGEM, y + 6, {
    width: LARGURA - largValor - 12,
    align: 'right',
    lineBreak: false,
  });
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
  doc.text(moeda(p.total), DIREITA - largValor, y + 5, {
    width: largValor - 10,
    align: 'right',
    lineBreak: false,
  });
}

/** Sempre aparece: com o texto do pedido, ou com uma linha para escrever à mão. */
function desenharObservacoes(
  doc: PDFKit.PDFDocument,
  y: number,
  altura: number,
  obs: string,
  largObs: number,
): void {
  doc.lineWidth(1).strokeColor(VERDE_ESCURO);
  doc.roundedRect(MARGEM, y, LARGURA, altura, 4).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(ESCURO);
  doc.text('OBSERVAÇÕES:', MARGEM + 10, y + 6, { lineBreak: false });

  const xTexto = DIREITA - largObs - 10;
  if (obs) {
    doc.font('Helvetica').fontSize(8.5).fillColor(ESCURO);
    doc.text(obs, xTexto, y + 5.5, { width: largObs });
  } else {
    doc
      .lineWidth(0.5)
      .strokeColor(LINHA)
      .moveTo(xTexto, y + 14)
      .lineTo(DIREITA - 10, y + 14)
      .stroke();
  }
}

/**
 * "Página X de Y" no pé de cada página, quando houver mais de uma.
 *
 * Feito no fim porque só aqui se sabe o total de páginas. `switchToPage` volta
 * em cada uma para escrever no mesmo lugar.
 */
function numerarPaginas(doc: PDFKit.PDFDocument): void {
  const total = doc.bufferedPageRange().count;
  if (total < 2) return;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    // O número fica abaixo da margem; sem isto o PDFKit abriria outra página.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
    doc.text(`Página ${i + 1} de ${total}`, MARGEM, PAGINA_Y, {
      width: LARGURA,
      align: 'center',
      lineBreak: false,
    });
  }
}
