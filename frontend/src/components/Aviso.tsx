import type { ReactNode } from 'react';

/**
 * Aviso padrão do sistema — toda mensagem em caixa na tela usa este componente,
 * para que a mesma cor signifique sempre a mesma coisa:
 *
 *   info    (cinza)    explicação neutra do que aquela tela faz
 *   dica    (verde)    orientação útil, nada de errado acontecendo
 *   atencao (amarelo)  algo que exige ação ou tem consequência
 *   erro    (vermelho) falhou, precisa corrigir
 *
 * A borda colorida à esquerda é o mesmo recurso visual dos cards de pedido,
 * o que mantém a leitura coerente entre as telas.
 */
export type TomAviso = 'info' | 'dica' | 'atencao' | 'erro';

interface Props {
  tom?: TomAviso;
  /** Primeira linha em negrito. Opcional — sem ele, só o texto. */
  titulo?: string;
  children: ReactNode;
  /** Botão ou link opcional, alinhado ao fim do aviso. */
  acao?: ReactNode;
  /** Espaçamento externo, definido por quem usa (ex.: "mb-4"). */
  className?: string;
  /** Versão compacta, para dentro de formulários. */
  compacto?: boolean;
}

const ESTILOS: Record<TomAviso, { caixa: string; icone: string }> = {
  info: {
    caixa: 'border-slate-300 bg-slate-50 text-slate-600',
    icone: 'text-slate-400',
  },
  dica: {
    caixa: 'border-brand-400 bg-brand-50 text-brand-800',
    icone: 'text-brand-500',
  },
  atencao: {
    caixa: 'border-brandYellow-400 bg-brandYellow-50 text-brandYellow-800',
    icone: 'text-brandYellow-700',
  },
  erro: {
    caixa: 'border-red-400 bg-red-50 text-red-700',
    icone: 'text-red-500',
  },
};

/** Ícones em SVG (e não emoji) para desenhar igual em qualquer aparelho. */
function Icone({ tom, className }: { tom: TomAviso; className: string }) {
  const comum = {
    className: `h-4 w-4 shrink-0 ${className}`,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (tom === 'dica') {
    // Lâmpada
    return (
      <svg {...comum}>
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
      </svg>
    );
  }
  if (tom === 'atencao') {
    // Triângulo de atenção
    return (
      <svg {...comum}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  if (tom === 'erro') {
    // Círculo com X
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }
  // info — círculo com i
  return (
    <svg {...comum}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function Aviso({
  tom = 'info',
  titulo,
  children,
  acao,
  className = '',
  compacto = false,
}: Props) {
  const estilo = ESTILOS[tom];
  return (
    <div
      role={tom === 'erro' ? 'alert' : undefined}
      className={`flex gap-2.5 rounded-xl border-l-4 ${estilo.caixa} ${
        compacto ? 'p-2.5' : 'p-3'
      } ${className}`}
    >
      <span className="mt-0.5">
        <Icone tom={tom} className={estilo.icone} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </div>
  );
}
