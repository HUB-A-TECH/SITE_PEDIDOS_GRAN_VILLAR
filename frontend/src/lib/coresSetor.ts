// Paleta dos setores. As classes ficam escritas por extenso para o Tailwind
// encontrá-las (ele não enxerga nomes montados em tempo de execução).

export type CorSetor = 'VERMELHO' | 'AMARELO' | 'VERDE' | 'AZUL' | 'LARANJA' | 'ROXO';

interface Paleta {
  nome: string;
  /** Fundo forte do cartão e da faixa. */
  fundo: string;
  /** Texto sobre o fundo forte. */
  texto: string;
  /** Borda esquerda das listas. */
  borda: string;
  /** Bolinha da cor (seletor do admin). */
  bolinha: string;
}

export const CORES_SETOR: Record<CorSetor, Paleta> = {
  VERMELHO: { nome: 'Vermelho', fundo: 'bg-red-600', texto: 'text-white', borda: 'border-red-600', bolinha: 'bg-red-600' },
  AMARELO: { nome: 'Amarelo', fundo: 'bg-yellow-400', texto: 'text-yellow-950', borda: 'border-yellow-400', bolinha: 'bg-yellow-400' },
  VERDE: { nome: 'Verde', fundo: 'bg-green-600', texto: 'text-white', borda: 'border-green-600', bolinha: 'bg-green-600' },
  AZUL: { nome: 'Azul', fundo: 'bg-blue-600', texto: 'text-white', borda: 'border-blue-600', bolinha: 'bg-blue-600' },
  LARANJA: { nome: 'Laranja', fundo: 'bg-orange-500', texto: 'text-white', borda: 'border-orange-500', bolinha: 'bg-orange-500' },
  ROXO: { nome: 'Roxo', fundo: 'bg-purple-600', texto: 'text-white', borda: 'border-purple-600', bolinha: 'bg-purple-600' },
};

/** As 4 cores iniciais, na ordem do rodízio das semanas. */
export const CORES_INICIAIS: CorSetor[] = ['VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];

/** Paleta da cor (cinza se vier uma cor desconhecida ou nenhuma). */
export function paleta(cor: string | null | undefined): Paleta {
  return (
    CORES_SETOR[cor as CorSetor] ?? {
      nome: 'Sem cor',
      fundo: 'bg-slate-500',
      texto: 'text-white',
      borda: 'border-slate-400',
      bolinha: 'bg-slate-400',
    }
  );
}
