export type StatusPedido = 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO';

// Estado de revisão do comercial: pendente/alterado precisam de revisão;
// revisado = aprovado sem mudanças posteriores; null = não enviado.
export type Revisao = 'PENDENTE' | 'ALTERADO' | 'REVISADO' | null;

export interface EstiloStatus {
  label: string;
  /** Cor do texto do rótulo. */
  textClass: string;
  /** Cor da borda (fina) do card — usada junto com `border-l-4`. */
  borderClass: string;
  /** Etiqueta para a fila do comercial (novo / alterado). */
  badge: string | null;
}

/**
 * Cor e rótulo de um pedido:
 * 🔴 cancelado · 🟢 aprovado · 🟡 em análise (novo ou alterado após revisão).
 */
export function estiloStatus(
  status: StatusPedido,
  revisao: Revisao,
): EstiloStatus {
  if (status === 'CANCELADO') {
    return {
      label: 'Cancelado',
      textClass: 'text-red-500',
      borderClass: 'border-red-400',
      badge: null,
    };
  }
  if (status === 'RASCUNHO') {
    return {
      label: 'A confirmar',
      textClass: 'text-slate-500',
      borderClass: 'border-slate-300',
      badge: null,
    };
  }
  // CONFIRMADO (enviado)
  if (revisao === 'REVISADO') {
    return {
      label: 'Aprovado',
      textClass: 'text-brand-600',
      borderClass: 'border-brand-500',
      badge: null,
    };
  }
  if (revisao === 'ALTERADO') {
    return {
      label: 'Em análise',
      textClass: 'text-brandYellow-700',
      borderClass: 'border-brandYellow-400',
      badge: 'Alterado',
    };
  }
  // PENDENTE
  return {
    label: 'Em análise',
    textClass: 'text-brandYellow-700',
    borderClass: 'border-brandYellow-400',
    badge: 'Novo',
  };
}

// ---- Agrupamento da tela "Meus Pedidos" ----

export type Grupo = 'A_CONFIRMAR' | 'EM_ANALISE' | 'APROVADOS' | 'CANCELADOS';

export interface DefinicaoGrupo {
  chave: Grupo;
  titulo: string;
  /** Frase curta abaixo do título, explicando o que aquele grupo significa. */
  descricao: string;
  /** Cor da bolinha ao lado do título — a mesma da borda dos cards. */
  pontoClass: string;
  /** Grupos "resolvidos" começam recolhidos: a tela abre no que exige ação. */
  recolhidoPorPadrao: boolean;
}

/** Ordem das seções: primeiro o que espera ação do vendedor. */
export const GRUPOS: DefinicaoGrupo[] = [
  {
    chave: 'A_CONFIRMAR',
    titulo: 'A confirmar',
    descricao: 'Salvos no seu celular. A administração ainda não recebeu.',
    pontoClass: 'bg-slate-400',
    recolhidoPorPadrao: false,
  },
  {
    chave: 'EM_ANALISE',
    titulo: 'Em análise',
    descricao: 'Enviados. Aguardando a administração revisar.',
    pontoClass: 'bg-brandYellow-400',
    recolhidoPorPadrao: false,
  },
  {
    chave: 'APROVADOS',
    titulo: 'Aprovados',
    descricao: 'Já revisados pela administração.',
    pontoClass: 'bg-brand-500',
    recolhidoPorPadrao: true,
  },
  {
    chave: 'CANCELADOS',
    titulo: 'Cancelados',
    descricao: 'Pedidos cancelados.',
    pontoClass: 'bg-red-400',
    recolhidoPorPadrao: true,
  },
];

/** Em qual seção o pedido aparece. Mesma origem de verdade das cores. */
export function grupoDoPedido(status: StatusPedido, revisao: Revisao): Grupo {
  if (status === 'CANCELADO') return 'CANCELADOS';
  if (status === 'RASCUNHO') return 'A_CONFIRMAR';
  return revisao === 'REVISADO' ? 'APROVADOS' : 'EM_ANALISE';
}
