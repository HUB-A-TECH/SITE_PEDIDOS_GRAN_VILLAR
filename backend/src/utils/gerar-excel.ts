// Gera a planilha Excel (.xlsx) do pedido na mesma ordem de itens do PDF
// (categoria e nome do produto): Coluna A = código do produto, Coluna B = quantidade.
import * as XLSX from 'xlsx';

export interface PedidoExcel {
  itens: {
    produtoCodigo: string;
    quantidade: number;
  }[];
}

/** Formata o conteúdo do Excel do pedido com um item por linha: `[codigoProduto, quantidade]`. */
export function gerarExcelPedido(p: PedidoExcel): Buffer {
  const linhas = p.itens.map((it) => [it.produtoCodigo.trim(), it.quantidade]);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
