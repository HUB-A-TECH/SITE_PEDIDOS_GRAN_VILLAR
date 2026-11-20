import { describe, expect, it } from 'vitest';
import { ordenarClientesPorFantasia } from '../src/lib/carteira';
import { situacaoPedido } from '../src/modules/historico/historico.service';

describe('ordenarClientesPorFantasia', () => {
  it('ordena de A a Z priorizando o nome fantasia e usando razão social quando faltar', () => {
    const entrada = [
      { codigo: '003', nome: 'Comercial Alpha Ltda', nomeFantasia: 'Zebra Mercado' },
      { codigo: '001', nome: 'Beta Alimentos SA', nomeFantasia: null },
      { codigo: '002', nome: 'Zeta Comércio', nomeFantasia: 'Água Viva' },
      { codigo: '004', nome: 'Casa da Carne ME', nomeFantasia: '   ' },
    ];

    const ordenado = ordenarClientesPorFantasia(entrada);
    expect(ordenado.map((c) => c.codigo)).toEqual(['002', '001', '004', '003']);
  });
});

describe('situacaoPedido', () => {
  it('marca como EM_ANALISE sem revisão ou com edição posterior do vendedor, e APROVADO quando revisado', () => {
    const t1 = new Date('2026-11-20T10:00:00Z');
    const t2 = new Date('2026-11-20T11:00:00Z');
    expect(situacaoPedido({ editadoEm: null, ultimaAlteracaoEm: null })).toBe('EM_ANALISE');
    expect(situacaoPedido({ editadoEm: t1, ultimaAlteracaoEm: t1 })).toBe('APROVADO');
    expect(situacaoPedido({ editadoEm: t1, ultimaAlteracaoEm: t2 })).toBe('EM_ANALISE');
  });
});
