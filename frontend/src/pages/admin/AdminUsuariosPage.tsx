import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Aviso } from '../../components/Aviso';
import { useDialogo } from '../../context/DialogoContext';
import * as usuariosApi from '../../lib/usuariosApi';
import type { Perfil, Usuario } from '../../lib/usuariosApi';
import { listarLocais } from '../../lib/clientesApi';
import type { Local } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';

const PERFIL_LABEL: Record<Perfil, string> = {
  VENDEDOR: 'Vendedor',
  ADMIN_COMERCIAL: 'Comercial',
  COMERCIAL_VENDEDOR: 'Comercial + Vendedor',
  ADMIN_TI: 'Admin TI',
};

const PERFIL_COR: Record<Perfil, string> = {
  VENDEDOR: 'bg-brand-100 text-brand-800',
  ADMIN_COMERCIAL: 'bg-amber-100 text-amber-800',
  COMERCIAL_VENDEDOR: 'bg-sky-100 text-sky-800',
  ADMIN_TI: 'bg-slate-200 text-slate-700',
};

const PERFIL_DESC: Record<Perfil, string> = {
  VENDEDOR: 'Faz pedidos dos clientes do setor dele.',
  ADMIN_COMERCIAL: 'Aprova pedidos, cuida de clientes, produtos e preços.',
  COMERCIAL_VENDEDOR:
    'Uma conta só para as duas funções: troca entre Comercial e Vendedor por um botão na tela inicial.',
  ADMIN_TI: 'Acesso total, inclusive usuários e dados da empresa.',
};

const vende = (p: Perfil) => p === 'VENDEDOR' || p === 'COMERCIAL_VENDEDOR';

/** Botões de escolha do perfil (um aceso por vez). */
function EscolhaPerfil({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Perfil[];
  valor: Perfil;
  onChange: (p: Perfil) => void;
}) {
  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-slate-700">Perfil</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Perfil">
        {opcoes.map((p) => {
          const ativo = p === valor;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onChange(p)}
              className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
                ativo
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {PERFIL_LABEL[p]}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{PERFIL_DESC[valor]}</p>
    </div>
  );
}

function SeletorFilial({
  locais,
  valor,
  onChange,
}: {
  locais: Local[];
  valor: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">Filial</label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500"
      >
        <option value="">Selecione…</option>
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

const FORM_VAZIO = {
  perfil: 'VENDEDOR' as Perfil,
  username: '',
  email: '',
  senha: '',
  nomeCompleto: '',
  telefone: '',
  localId: '',
};

export function AdminUsuariosPage() {
  const dialogo = useDialogo();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  /** Usuário sendo corrigido. Null = a janela aberta é a de criar. */
  const [editando, setEditando] = useState<Usuario | null>(null);

  function carregar() {
    setCarregando(true);
    usuariosApi
      .listarUsuarios()
      .then(setUsuarios)
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    listarLocais().then(setLocais);
  }, []);

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, localId: locais[0]?.id ?? '' });
    setErro('');
    setModalAberto(true);
  }

  async function salvar() {
    setErro('');
    const ehVendedor = vende(form.perfil);
    if (ehVendedor && (!form.nomeCompleto.trim() || !form.localId)) {
      setErro('Para quem vende, informe o nome completo e a filial.');
      return;
    }
    setSalvando(true);
    try {
      await usuariosApi.criarUsuario({
        perfil: form.perfil,
        username: form.username.trim(),
        email: form.email.trim(),
        senha: form.senha,
        nomeCompleto: ehVendedor ? form.nomeCompleto.trim() : undefined,
        telefone: ehVendedor && form.telefone.trim() ? form.telefone.trim() : undefined,
        localId: ehVendedor ? form.localId : undefined,
      });
      setModalAberto(false);
      carregar();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.mensagem) {
        setErro(e.response.data.mensagem);
      } else {
        setErro('Não foi possível criar o usuário.');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(u: Usuario) {
    const desativando = u.ativo;
    const ok = await dialogo.confirmar({
      titulo: desativando ? 'Desativar usuário' : 'Reativar usuário',
      destrutivo: desativando,
      textoConfirmar: desativando ? 'Desativar' : 'Reativar',
      mensagem: desativando ? (
        <>
          <strong>{u.username}</strong> perde o acesso na hora, mesmo se estiver
          usando o sistema neste momento.
        </>
      ) : (
        <>
          <strong>{u.username}</strong> volta a poder entrar no sistema.
        </>
      ),
    });
    if (!ok) return;
    try {
      await usuariosApi.alterarAtivo(u.id, !u.ativo);
      carregar();
    } catch (e) {
      await dialogo.avisar({
        titulo: 'Não foi possível alterar',
        tom: 'erro',
        mensagem:
          axios.isAxiosError(e) && e.response?.data?.mensagem
            ? e.response.data.mensagem
            : 'Tente novamente em alguns instantes.',
      });
    }
  }

  async function resetarSenha(u: Usuario) {
    const senha = await dialogo.pedirTexto({
      titulo: `Nova senha de ${u.username}`,
      rotulo: 'Nova senha',
      tipo: 'password',
      mensagem:
        'A senha é gravada criptografada — nem o sistema consegue lê-la depois. Anote antes de confirmar.',
      validar: (v) =>
        v.length < 6 ? 'A senha deve ter ao menos 6 caracteres.' : null,
    });
    if (senha === null) return;
    try {
      await usuariosApi.resetarSenha(u.id, senha);
      await dialogo.avisar({
        titulo: 'Senha atualizada',
        tom: 'dica',
        mensagem: (
          <>
            <strong>{u.username}</strong> já pode entrar com a senha nova.
          </>
        ),
      });
    } catch {
      await dialogo.avisar({
        titulo: 'Não foi possível alterar a senha',
        tom: 'erro',
        mensagem: 'Tente novamente em alguns instantes.',
      });
    }
  }

  const ehVendedor = vende(form.perfil);

  return (
    <AppLayout titulo="Usuários" voltarPara="/">
      <button
        onClick={abrirNovo}
        className="mb-4 w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        + Novo usuário
      </button>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {usuarios.map((u) => (
            <li key={u.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">
                      {u.vendedor?.nomeCompleto ?? u.username}
                    </p>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PERFIL_COR[u.perfil]}`}>
                      {PERFIL_LABEL[u.perfil]}
                    </span>
                    {!u.ativo && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {u.username} · {u.email}
                    {u.local ? ` · ${u.local.nome}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditando(u)}
                  className="flex-1 rounded-lg bg-slate-100 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Editar
                </button>
                <button
                  onClick={() => resetarSenha(u)}
                  className="flex-1 rounded-lg bg-slate-100 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Resetar senha
                </button>
                <button
                  onClick={() => toggleAtivo(u)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${
                    u.ativo
                      ? 'border border-red-200 text-red-600 hover:bg-red-50'
                      : 'border border-brand-200 text-brand-700 hover:bg-brand-50'
                  }`}
                >
                  {u.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.username}` : ''}
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
      >
        {editando && (
          <EditarUsuarioForm
            usuario={editando}
            locais={locais}
            onSalvar={() => {
              setEditando(null);
              carregar();
            }}
          />
        )}
      </Modal>

      <Modal titulo="Novo usuário" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <div className="space-y-3">
          <EscolhaPerfil
            opcoes={['VENDEDOR', 'ADMIN_COMERCIAL', 'COMERCIAL_VENDEDOR', 'ADMIN_TI']}
            valor={form.perfil}
            onChange={(perfil) => setForm({ ...form, perfil })}
          />

          {ehVendedor && (
            <>
              <Campo
                label="Nome completo"
                value={form.nomeCompleto}
                onChange={(v) => setForm({ ...form, nomeCompleto: v })}
              />
              <SeletorFilial
                locais={locais}
                valor={form.localId}
                onChange={(localId) => setForm({ ...form, localId })}
              />
            </>
          )}

          <Campo
            label="Usuário (login)"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
          />
          <Campo
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Campo
            label="Senha"
            type="password"
            value={form.senha}
            onChange={(v) => setForm({ ...form, senha: v })}
          />

          {erro && (
            <Aviso tom="erro" compacto>
              {erro}
            </Aviso>
          )}

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {salvando ? 'Criando…' : 'Criar usuário'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500"
      />
    </div>
  );
}

/**
 * Correção de dados de quem já está cadastrado.
 *
 * O perfil pode mudar entre Vendedor, Comercial e Comercial + Vendedor — assim
 * quem usava uma senha compartilhada passa a ter a própria conta com as duas
 * funções, sem perder pedidos nem carteira. Admin TI fica de fora (e ninguém
 * muda o próprio perfil). Usuário de entrada e filial não mudam por aqui.
 */
function EditarUsuarioForm({
  usuario,
  locais,
  onSalvar,
}: {
  usuario: Usuario;
  locais: Local[];
  onSalvar: () => void;
}) {
  const { usuario: eu } = useAuth();
  const podeMudarPerfil = usuario.perfil !== 'ADMIN_TI' && usuario.id !== eu?.id;
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);
  const ehVendedor = vende(perfil);
  // Já teve cadastro de vendedor (mesmo inativo): nome e filial já existem.
  const temCadastroVendedor = usuario.vendedor !== null;
  const [email, setEmail] = useState(usuario.email);
  const [nomeCompleto, setNomeCompleto] = useState(
    usuario.vendedor?.nomeCompleto ?? '',
  );
  const [telefone, setTelefone] = useState(usuario.vendedor?.telefone ?? '');
  const [localId, setLocalId] = useState(usuario.local?.id ?? locais[0]?.id ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const dialogo = useDialogo();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (ehVendedor && !nomeCompleto.trim()) {
      setErro('O nome completo é obrigatório para quem vende.');
      return;
    }
    if (ehVendedor && !temCadastroVendedor && !localId) {
      setErro('Escolha a filial de quem vai vender.');
      return;
    }
    const mudouPerfil = perfil !== usuario.perfil;
    if (mudouPerfil) {
      const ok = await dialogo.confirmar({
        titulo: 'Mudar perfil',
        textoConfirmar: 'Mudar',
        mensagem: (
          <>
            <strong>{usuario.username}</strong> passa de{' '}
            <strong>{PERFIL_LABEL[usuario.perfil]}</strong> para{' '}
            <strong>{PERFIL_LABEL[perfil]}</strong>. Se estiver usando o sistema
            agora, vai precisar entrar de novo.
          </>
        ),
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      if (mudouPerfil) {
        await usuariosApi.mudarPerfil(usuario.id, {
          perfil: perfil as Exclude<Perfil, 'ADMIN_TI'>,
          ...(ehVendedor && !temCadastroVendedor
            ? { nomeCompleto: nomeCompleto.trim(), localId }
            : {}),
        });
      }
      await usuariosApi.atualizarUsuario(usuario.id, {
        email: email.trim(),
        ...(ehVendedor || temCadastroVendedor
          ? { nomeCompleto: nomeCompleto.trim() || undefined, telefone: telefone.trim() }
          : {}),
      });
      onSalvar();
    } catch (err) {
      setErro(
        axios.isAxiosError(err) && err.response?.data?.mensagem
          ? err.response.data.mensagem
          : 'Não foi possível salvar.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {podeMudarPerfil ? (
        <EscolhaPerfil
          opcoes={['VENDEDOR', 'ADMIN_COMERCIAL', 'COMERCIAL_VENDEDOR']}
          valor={perfil}
          onChange={setPerfil}
        />
      ) : (
        <Aviso compacto>
          {usuario.id === eu?.id
            ? 'Você não pode mudar o próprio perfil.'
            : 'O perfil de Admin TI não muda por aqui.'}
        </Aviso>
      )}

      {ehVendedor && (
        <>
          <Campo
            label="Nome completo"
            value={nomeCompleto}
            onChange={setNomeCompleto}
          />
          <Campo label="Telefone" value={telefone} onChange={setTelefone} />
          {!temCadastroVendedor && (
            <SeletorFilial locais={locais} valor={localId} onChange={setLocalId} />
          )}
        </>
      )}
      <Campo label="E-mail" value={email} onChange={setEmail} type="email" />

      <p className="text-xs text-slate-500">
        Nome de usuário e filial não mudam por aqui. Para trocar a senha, use{' '}
        <strong>Resetar senha</strong>.
      </p>

      {erro && (
        <Aviso tom="erro" compacto>
          {erro}
        </Aviso>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}
