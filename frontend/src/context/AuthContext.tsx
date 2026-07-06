import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';

export type UserType = 'VENDEDOR' | 'ADMIN_COMERCIAL' | 'ADMIN_TI';

export interface Usuario {
  id: string;
  username: string;
  type: UserType;
  localId: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<{ usuario: Usuario }>('/auth/me')
      .then((res) => setUsuario(res.data.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  async function login(username: string, password: string) {
    const res = await api.post<{ usuario: Usuario }>('/auth/login', {
      username,
      password,
    });
    setUsuario(res.data.usuario);
  }

  async function logout() {
    await api.post('/auth/logout');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
