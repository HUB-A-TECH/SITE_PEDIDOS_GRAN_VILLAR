import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { iniciais } from '../lib/contato';
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
        <MenuConta nome={usuario?.username ?? ''} onSair={() => logout()} />
      </header>
      <main className={`mx-auto max-w-md p-4 ${largo ? 'layout-largo lg:max-w-6xl lg:p-6' : ''}`}>
        {children}
      </main>
    </div>
  );
}

/** Rostinho com as iniciais no canto: abre "Minha Conta" e "Sair". */
function MenuConta({ nome, onSair }: { nome: string; onSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao tocar fora do menu.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-label="Minha conta"
        aria-expanded={aberto}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-700 ring-2 ring-brand-300 hover:ring-white"
      >
        {iniciais(nome)}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl bg-white text-slate-700 shadow-lg ring-1 ring-slate-200">
          <p className="truncate border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">{nome}</p>
          <Link to="/minha-conta" className="block px-4 py-2.5 text-sm hover:bg-slate-50">
            Minha Conta
          </Link>
          <button
            onClick={onSair}
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
