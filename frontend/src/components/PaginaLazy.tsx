import { Component, Suspense, type ReactNode } from 'react';

/**
 * Envolve uma tela carregada sob demanda (React.lazy): mostra "Carregando…"
 * enquanto o arquivo da tela baixa e, se ele não chegar (sinal ruim), uma
 * mensagem com botão para tentar de novo — em vez de tela em branco.
 */
export function PaginaLazy({ children }: { children: ReactNode }) {
  return (
    <FalhaAoCarregar>
      <Suspense fallback={<p className="p-8 text-center text-slate-500">Carregando…</p>}>
        {children}
      </Suspense>
    </FalhaAoCarregar>
  );
}

class FalhaAoCarregar extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">
          Não foi possível carregar esta tela. Verifique o sinal e tente de novo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Tentar de novo
        </button>
      </div>
    );
  }
}
