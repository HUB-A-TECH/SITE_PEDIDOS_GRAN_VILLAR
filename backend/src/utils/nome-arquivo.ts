function limparParteNome(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface DadosNomeArquivoPedido {
  id: string;
  numeroPedido: string | null;
  cliente: {
    codigo: string;
    nome: string;
    nomeFantasia?: string | null;
  };
}

/**
 * Monta o nome padrão dos arquivos exportados do pedido:
 * `Gran_Villar_<codigoCliente>_<nomeFantasia>_<numeroPedido>.<ext>`
 */
export function nomeArquivoPedido(p: DadosNomeArquivoPedido, ext: 'pdf' | 'xlsx'): string {
  const codCliente = limparParteNome(p.cliente.codigo);
  const fantasia = limparParteNome(p.cliente.nomeFantasia?.trim() || p.cliente.nome);
  const codPedido = limparParteNome(p.numeroPedido ?? p.id.slice(0, 8));
  return `${['Gran_Villar', codCliente, fantasia, codPedido].filter(Boolean).join('_')}.${ext}`;
}
