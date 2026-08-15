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
      label: 'Salvo (não enviado)',
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
