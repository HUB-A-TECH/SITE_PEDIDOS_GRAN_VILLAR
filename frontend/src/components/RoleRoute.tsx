import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserType } from '../lib/types';

interface Props {
  permitido: UserType[];
  children: ReactNode;
}

// Restringe uma rota a determinados perfis (ex.: telas de admin).
export function RoleRoute({ permitido, children }: Props) {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando…
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  if (!permitido.includes(usuario.type)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
