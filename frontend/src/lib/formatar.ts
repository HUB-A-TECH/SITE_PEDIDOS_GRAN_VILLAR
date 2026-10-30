// Formatação de valores para a tela, num lugar só (antes cada página tinha a sua cópia).

/** Dinheiro em reais: R$ 1.234,50 */
export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Quantidade com até 3 casas (kg, g, litros). */
export const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Data: 28/10/2026 */
export const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Data e hora: 28/10/2026 14:30 */
export const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
