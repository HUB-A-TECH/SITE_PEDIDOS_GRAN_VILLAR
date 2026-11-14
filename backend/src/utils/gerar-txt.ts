// Gera o arquivo TXT do pedido no formato padronizado para importação:
// cada linha contém apenas <codigoProduto>|<quantidade>
// Encoding: UTF-8 | Quebra de linha: CRLF.

interface PedidoTxt {
  numeroPedido?: string | null;
  status?: string;
  confirmadoEm?: Date | null;
  criadoEm?: Date;
  observacoes?: string | null;
  total?: number;
  subtotal?: number;
  local?: { codigo: string; nome: string };
  vendedor?: { nomeCompleto: string };
  cliente?: { codigo: string; nome: string; nomeFantasia: string | null; cnpj: string | null };
  itens: {
    produtoCodigo: string;
    produtoNome?: string;
    unidadeMedida?: string;
    quantidade: number;
    precoUnitario?: number;
    subtotal?: number;
  }[];
}

const qtd = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Formata o conteúdo do TXT do pedido com um item por linha: `<codigoProduto>|<quantidade>`. */
export function gerarTxtPedido(p: PedidoTxt): string {
  if (p.itens.length === 0) return '';
  return p.itens.map((it) => `${it.produtoCodigo.trim()}|${qtd(it.quantidade)}`).join('\r\n') + '\r\n';
}
