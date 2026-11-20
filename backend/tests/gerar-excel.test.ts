import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { gerarExcelPedido } from '../src/utils/gerar-excel';
import { nomeArquivoPedido } from '../src/utils/nome-arquivo';

describe('gerarExcelPedido', () => {
  it('gera planilha com código do produto na coluna A e quantidade na coluna B na ordem dos itens', () => {
    const buffer = gerarExcelPedido({
      itens: [
        { produtoCodigo: ' 0012 ', quantidade: 3 },
        { produtoCodigo: 'ABC-99', quantidade: 2.5 },
      ],
    });

    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Pedido']);
    const ws = wb.Sheets.Pedido;
    const linhas = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    expect(linhas).toEqual([
      ['0012', 3],
      ['ABC-99', 2.5],
    ]);
  });

  it('gera planilha vazia quando não há itens', () => {
    const buffer = gerarExcelPedido({ itens: [] });
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(linhas).toEqual([]);
  });
});

describe('nomeArquivoPedido', () => {
  it('monta Gran_Villar_<codigoCliente>_<nomeFantasia>_<numeroPedido> em PDF e Excel', () => {
    const pedido = {
      id: '12345678-aaaa-bbbb-cccc-123456789012',
      numeroPedido: '2026-000015',
      cliente: {
        codigo: '042',
        nome: 'Açaí Comércio Ltda',
        nomeFantasia: 'Açaí & Cia',
      },
    };
    expect(nomeArquivoPedido(pedido, 'pdf')).toBe('Gran_Villar_042_Acai_Cia_2026-000015.pdf');
    expect(nomeArquivoPedido(pedido, 'xlsx')).toBe('Gran_Villar_042_Acai_Cia_2026-000015.xlsx');
  });

  it('usa razão social e início do id quando nome fantasia e número ainda não existem', () => {
    const pedido = {
      id: 'abcdef12-0000-0000-0000-000000000000',
      numeroPedido: null,
      cliente: {
        codigo: '001',
        nome: 'Mercado X',
        nomeFantasia: null,
      },
    };
    expect(nomeArquivoPedido(pedido, 'xlsx')).toBe('Gran_Villar_001_Mercado_X_abcdef12.xlsx');
  });
});
