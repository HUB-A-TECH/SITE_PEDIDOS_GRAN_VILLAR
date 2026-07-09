import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, usuario, carregando } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch {
      setErro('Usuário ou senha inválidos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg">
        {/* Faixa tricolor na mesma ordem da logo: amarelo, verde, vermelho */}
        <div className="flex h-1.5 w-full">
          <div className="flex-1 bg-brandYellow-400" />
          <div className="flex-1 bg-brand-500" />
          <div className="flex-1 bg-brandRed-500" />
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
            <img
              src="/logo-gran-villar.png"
              alt="Gran Villar"
              className="mx-auto mb-2 h-20 w-auto"
            />
            <p className="text-sm text-slate-500">Sistema de Pedidos</p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Usuário
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
