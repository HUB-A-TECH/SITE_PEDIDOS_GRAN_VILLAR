import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
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
  /** Atualiza o usuário na tela (ex.: trocou o nome de usuário em Minha Conta). */
  atualizarUsuario: (u: Usuario) => void;
  /** Por que a sessão caiu sozinha (senha trocada em outro aparelho etc.). */
  avisoSaida: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Chamadas em que 401 é resposta normal, não "a sessão caiu".
const ROTAS_DE_LOGIN = ['/auth/login', '/auth/me', '/auth/logout'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [avisoSaida, setAvisoSaida] = useState<string | null>(null);
  const conectado = useRef(false);
  conectado.current = usuario !== null;

  useEffect(() => {
    api
      .get<{ usuario: Usuario }>('/auth/me')
      .then((res) => setUsuario(res.data.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  // Sessão que cai no meio do uso (senha trocada em outro aparelho, conta
  // desativada, 8h expiradas): em vez de os botões só darem erro, volta para
  // o login explicando o motivo.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (erro) => {
      if (
        axios.isAxiosError(erro) &&
        erro.response?.status === 401 &&
        conectado.current &&
        !ROTAS_DE_LOGIN.some((r) => erro.config?.url?.startsWith(r))
      ) {
        setAvisoSaida(
          erro.response.data?.mensagem && erro.response.data.mensagem !== 'Não autenticado'
            ? erro.response.data.mensagem
            : 'Sua sessão terminou. Entre novamente.',
        );
        setUsuario(null);
      }
      return Promise.reject(erro);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  async function login(username: string, password: string) {
    const res = await api.post<{ usuario: Usuario }>('/auth/login', {
      username,
      password,
    });
    setAvisoSaida(null);
    setUsuario(res.data.usuario);
  }

  async function logout() {
    await api.post('/auth/logout');
    setAvisoSaida(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, login, logout, atualizarUsuario: setUsuario, avisoSaida }}
    >
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
