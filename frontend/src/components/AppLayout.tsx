import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  titulo: string;
  voltarPara?: string;
  /**
   * Telas que abrem de vários lugares (ex.: perfil do cliente, aberto pela
   * lista ou de dentro de um pedido): o "←" volta para a tela anterior, e só
   * usa `voltarPara` quando a página foi aberta direto (sem tela anterior).
   */
  voltarUsaHistorico?: boolean;
  children: ReactNode;
  acao?: ReactNode;
}

export function AppLayout({
  titulo,
  voltarPara,
  voltarUsaHistorico = false,
  children,
  acao,
}: Props) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Modelo (só local): admin em tela grande usa a largura toda do computador.
  const largo = usuario?.type === 'ADMIN_COMERCIAL' || usuario?.type === 'ADMIN_TI';

  function voltar() {
    // key "default" = primeira página aberta nesta aba: não há para onde voltar.
    if (voltarUsaHistorico && location.key !== 'default') navigate(-1);
    else if (voltarPara) navigate(voltarPara);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
        {voltarPara && (
          <button
            onClick={voltar}
            aria-label="Voltar"
            className="rounded-lg px-2 py-1 text-lg hover:bg-brand-700"
          >
            ←
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{titulo}</p>
          <p className="text-xs text-brand-100">{usuario?.username}</p>
        </div>
        {acao}
        <button
          onClick={() => logout()}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm hover:bg-brand-800"
        >
          Sair
        </button>
      </header>
      <main className={`mx-auto max-w-md p-4 ${largo ? 'layout-largo lg:max-w-6xl lg:p-6' : ''}`}>
        {children}
      </main>
    </div>
  );
}
