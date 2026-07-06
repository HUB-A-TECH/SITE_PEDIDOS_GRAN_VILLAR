import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
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

  return <>{children}</>;
}
