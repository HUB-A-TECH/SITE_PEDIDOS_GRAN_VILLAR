import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import { AppLayout } from '../components/AppLayout';
import { Aviso } from '../components/Aviso';
import { useAuth } from '../context/AuthContext';
import * as contaApi from '../lib/contaApi';
import type { MinhaConta } from '../lib/contaApi';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';
const botaoCls =
  'w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60';

const mensagemErro = (e: unknown, padrao: string) =>
  axios.isAxiosError(e) && e.response?.data?.mensagem ? e.response.data.mensagem : padrao;

type Resultado = { tom: 'dica' | 'erro'; texto: string } | null;

/**
 * "Minha Conta": cada pessoa muda os próprios dados, o usuário de entrada e a
 * senha. Os dados dos clientes não ficam aqui (só o admin edita).
 */
export function MinhaContaPage() {
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    contaApi
      .obter()
      .then(setConta)
      .catch((e) => setErro(mensagemErro(e, 'Não foi possível carregar sua conta.')));
  }, []);

  return (
    <AppLayout titulo="Minha Conta" voltarPara="/">
      {!conta ? (
        erro ? (
          <Aviso tom="erro">{erro}</Aviso>
        ) : (
          <p className="text-center text-slate-500">Carregando…</p>
        )
      ) : (
        <div className="space-y-4">
          <FormDados conta={conta} onSalvo={setConta} />
          <FormUsuario conta={conta} onSalvo={setConta} />
          <FormSenha />
        </div>
      )}
    </AppLayout>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-700">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Mensagem({ resultado }: { resultado: Resultado }) {
  if (!resultado) return null;
  return (
    <Aviso tom={resultado.tom} compacto>
      {resultado.texto}
    </Aviso>
  );
}

// ---- Meus dados ----

function FormDados({ conta, onSalvo }: { conta: MinhaConta; onSalvo: (c: MinhaConta) => void }) {
  const ehVendedor = conta.type === 'VENDEDOR';
  const [nome, setNome] = useState(conta.nomeCompleto ?? '');
  const [telefone, setTelefone] = useState(conta.telefone ?? '');
  const [email, setEmail] = useState(conta.email);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setResultado(null);
    try {
      const atualizada = await contaApi.atualizarDados({
        email: email.trim(),
        ...(ehVendedor ? { nomeCompleto: nome.trim(), telefone: telefone.trim() } : {}),
      });
      onSalvo(atualizada);
      setResultado({ tom: 'dica', texto: 'Dados salvos.' });
    } catch (err) {
      setResultado({ tom: 'erro', texto: mensagemErro(err, 'Não foi possível salvar.') });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao titulo="Meus dados">
      <form onSubmit={salvar} className="space-y-3">
        {ehVendedor && (
          <>
            <Campo label="Nome completo">
              <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} className={inputCls} />
            </Campo>
            <Campo label="Telefone (opcional)">
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 98888-7777"
                className={inputCls}
              />
            </Campo>
          </>
        )}
        <Campo label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </Campo>
        <Mensagem resultado={resultado} />
        <button type="submit" disabled={salvando} className={botaoCls}>
          {salvando ? 'Salvando…' : 'Salvar dados'}
        </button>
      </form>
    </Cartao>
  );
}

// ---- Usuário de entrada ----

function FormUsuario({ conta, onSalvo }: { conta: MinhaConta; onSalvo: (c: MinhaConta) => void }) {
  const { atualizarUsuario } = useAuth();
  const [username, setUsername] = useState(conta.username);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setResultado(null);
    if (username.trim() === conta.username) {
      setResultado({ tom: 'erro', texto: 'Esse já é o seu usuário.' });
      return;
    }
    setSalvando(true);
    try {
      const { usuario, ...atualizada } = await contaApi.trocarUsuario(username.trim(), senhaAtual);
      onSalvo(atualizada);
      atualizarUsuario(usuario);
      setSenhaAtual('');
      setResultado({ tom: 'dica', texto: `Pronto. Da próxima vez, entre com "${usuario.username}".` });
    } catch (err) {
      setResultado({ tom: 'erro', texto: mensagemErro(err, 'Não foi possível trocar o usuário.') });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao titulo="Usuário de entrada">
      <form onSubmit={salvar} className="space-y-3">
        <Campo label="Usuário">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoComplete="username"
            autoCapitalize="none"
            className={inputCls}
          />
        </Campo>
        <p className="-mt-1 text-xs text-slate-400">Letras, números, ponto, hífen ou _ (sem espaço).</p>
        <Campo label="Senha atual (para confirmar)">
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </Campo>
        <Mensagem resultado={resultado} />
        <button type="submit" disabled={salvando} className={botaoCls}>
          {salvando ? 'Salvando…' : 'Trocar usuário'}
        </button>
      </form>
    </Cartao>
  );
}

// ---- Senha ----

function FormSenha() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setResultado(null);
    if (novaSenha.length < 6) {
      setResultado({ tom: 'erro', texto: 'A nova senha deve ter ao menos 6 caracteres.' });
      return;
    }
    if (novaSenha !== repetir) {
      setResultado({ tom: 'erro', texto: 'A nova senha e a repetição não estão iguais.' });
      return;
    }
    setSalvando(true);
    try {
      await contaApi.trocarSenha(senhaAtual, novaSenha);
      setSenhaAtual('');
      setNovaSenha('');
      setRepetir('');
      setResultado({
        tom: 'dica',
        texto: 'Senha alterada. Você continua conectado aqui; os outros aparelhos foram desconectados.',
      });
    } catch (err) {
      setResultado({ tom: 'erro', texto: mensagemErro(err, 'Não foi possível trocar a senha.') });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao titulo="Senha">
      <form onSubmit={salvar} className="space-y-3">
        <Campo label="Senha atual">
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </Campo>
        <Campo label="Nova senha (mínimo 6 caracteres)">
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            autoComplete="new-password"
            className={inputCls}
          />
        </Campo>
        <Campo label="Repita a nova senha">
          <input
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            required
            autoComplete="new-password"
            className={inputCls}
          />
        </Campo>
        <p className="-mt-1 text-xs text-slate-400">
          Ao trocar, os outros aparelhos em que você está conectado saem da conta.
        </p>
        <Mensagem resultado={resultado} />
        <button type="submit" disabled={salvando} className={botaoCls}>
          {salvando ? 'Trocando…' : 'Trocar senha'}
        </button>
      </form>
    </Cartao>
  );
}
