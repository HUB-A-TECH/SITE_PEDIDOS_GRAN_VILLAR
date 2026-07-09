import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  titulo: string;
  voltarPara?: string;
  children: ReactNode;
  acao?: ReactNode;
}

export function AppLayout({ titulo, voltarPara, children, acao }: Props) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
        {voltarPara && (
          <button
            onClick={() => navigate(voltarPara)}
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
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
