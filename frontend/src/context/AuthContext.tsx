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
import type { UserType } from '../lib/types';


declare global {
  interface Window {
    /** Preenchido por public/pre-sessao.js antes do site terminar de carregar. */
    __sessao?: Promise<{ status: number; usuario?: Usuario } | null>;
  }
}

export interface Usuario {
  id: string;
  username: string;
  /** Modo em que a sessão está agora (quem é Comercial + Vendedor troca pelo botão). */
  type: UserType;
  localId: string | null;
  /** Modos que a conta pode usar. Mais de um = mostra o botão de troca. */
  modos?: UserType[];
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Atualiza o usuário na tela (ex.: trocou o nome de usuário em Minha Conta). */
  atualizarUsuario: (u: Usuario) => void;
  /** Comercial + Vendedor: passa a sessão para o outro modo. */
  trocarModo: (modo: UserType) => Promise<void>;
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
    // Só 401 significa "não está logado". Falha de rede/servidor dormindo não
    // pode jogar o vendedor no login: tenta de novo algumas vezes antes.
    let cancelado = false;
    async function verificarSessao() {
      // Resposta que o index.html já foi buscar (public/pre-sessao.js), em paralelo
      // com o download do site. Só vale na 1ª vez.
      const pre = window.__sessao;
      window.__sessao = undefined;
      if (pre) {
        const r = await pre;
        if (cancelado) return;
        if (r?.status === 200 && r.usuario) {
          setUsuario(r.usuario);
          setCarregando(false);
          return;
        }
        if (r?.status === 401) {
          setCarregando(false);
          return;
        }
      }
      for (let tentativa = 0; tentativa < 4 && !cancelado; tentativa++) {
        try {
          const res = await api.get<{ usuario: Usuario }>('/auth/me');
          if (!cancelado) setUsuario(res.data.usuario);
          break;
        } catch (erro) {
          const semSessao = axios.isAxiosError(erro) && erro.response?.status === 401;
          if (semSessao) break;
          if (tentativa < 3) await new Promise((r) => setTimeout(r, 4000));
        }
      }
      if (!cancelado) setCarregando(false);
    }
    verificarSessao();
    return () => {
      cancelado = true;
    };
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

  async function trocarModo(modo: UserType) {
    const res = await api.post<{ usuario: Usuario }>('/auth/modo', { modo });
    setUsuario(res.data.usuario);
  }

  async function logout() {
    await api.post('/auth/logout');
    setAvisoSaida(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        carregando,
        login,
        logout,
        atualizarUsuario: setUsuario,
        trocarModo,
        avisoSaida,
      }}
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
