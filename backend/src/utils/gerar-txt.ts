// Gera o arquivo TXT do pedido no formato da Seção 3.2 do planejamento.
// Encoding: UTF-8 | Quebra de linha: CRLF.

interface PedidoTxt {
  numeroPedido: string | null;
  status: string;
  confirmadoEm: Date | null;
  criadoEm: Date;
  observacoes: string | null;
  total: number;
  subtotal: number;
  local: { codigo: string; nome: string };
  vendedor: { nomeCompleto: string };
  cliente: { codigo: string; nome: string; nomeFantasia: string | null; cnpj: string | null };
  itens: {
    produtoCodigo: string;
    produtoNome: string;
    unidadeMedida: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
  }[];
}

const LARGURA = 60;
const LINHA_DUPLA = '='.repeat(LARGURA);
const LINHA_SIMPLES = '-'.repeat(LARGURA);

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qtd = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function dataBR(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}

function dataHora(d: Date): string {
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
}

function centralizar(texto: string): string {
  const espacos = Math.max(0, Math.floor((LARGURA - texto.length) / 2));
  return ' '.repeat(espacos) + texto;
}

export function gerarTxtPedido(p: PedidoTxt): string {
  const linhas: string[] = [];
  const data = p.confirmadoEm ?? p.criadoEm;

  linhas.push(LINHA_DUPLA);
  linhas.push(centralizar('GRAN VILLAR - PEDIDO'));
  linhas.push(LINHA_DUPLA);
  linhas.push(`Pedido No : ${p.numeroPedido ?? '(rascunho)'}`);
  linhas.push(`Data      : ${dataBR(data)}`);
  linhas.push(`Status    : ${p.status}`);
  linhas.push(LINHA_SIMPLES);
  linhas.push(`FILIAL    : [${p.local.codigo}] ${p.local.nome}`);
  linhas.push(`VENDEDOR  : ${p.vendedor.nomeCompleto}`);
  const fantasia = p.cliente.nomeFantasia ? ` (${p.cliente.nomeFantasia})` : '';
  linhas.push(`CLIENTE   : [${p.cliente.codigo}] ${p.cliente.nome}${fantasia}`);
  if (p.cliente.cnpj) linhas.push(`CNPJ      : ${p.cliente.cnpj}`);
  linhas.push(LINHA_SIMPLES);
  linhas.push('ITENS');
  linhas.push(LINHA_SIMPLES);
  linhas.push(
    'COD'.padEnd(7) +
      'PRODUTO'.padEnd(23) +
      'QTD'.padStart(5) +
      ' UN'.padEnd(5) +
      'UNIT'.padStart(9) +
      'SUBTOTAL'.padStart(11),
  );
  linhas.push(LINHA_SIMPLES);
  for (const it of p.itens) {
    linhas.push(
      it.produtoCodigo.padEnd(7) +
        it.produtoNome.slice(0, 22).padEnd(23) +
        qtd(it.quantidade).padStart(5) +
        ` ${it.unidadeMedida}`.padEnd(5) +
        moeda(it.precoUnitario).padStart(9) +
        moeda(it.subtotal).padStart(11),
    );
  }
  linhas.push(LINHA_SIMPLES);
  linhas.push(`SUBTOTAL:`.padStart(49) + moeda(p.subtotal).padStart(11));
  linhas.push(`TOTAL: R$`.padStart(49) + moeda(p.total).padStart(11));
  linhas.push(LINHA_SIMPLES);
  if (p.observacoes && p.observacoes.trim()) {
    linhas.push('OBSERVACOES:');
    linhas.push(p.observacoes.trim());
    linhas.push(LINHA_SIMPLES);
  }
  linhas.push(`Gerado em ${dataHora(new Date())}`);
  linhas.push(LINHA_DUPLA);

  return linhas.join('\r\n') + '\r\n';
}
