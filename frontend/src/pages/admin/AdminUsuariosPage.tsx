import { useEffect, useState } from 'react';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import * as usuariosApi from '../../lib/usuariosApi';
import type { Usuario } from '../../lib/usuariosApi';
import { listarLocais } from '../../lib/clientesApi';
import type { Local, UserType } from '../../lib/types';

const TIPO_LABEL: Record<UserType, string> = {
  VENDEDOR: 'Vendedor',
  ADMIN_COMERCIAL: 'Admin Comercial',
  ADMIN_TI: 'Admin TI',
};

const TIPO_COR: Record<UserType, string> = {
  VENDEDOR: 'bg-brand-100 text-brand-800',
  ADMIN_COMERCIAL: 'bg-amber-100 text-amber-800',
  ADMIN_TI: 'bg-slate-200 text-slate-700',
};

const FORM_VAZIO = {
  tipo: 'VENDEDOR' as UserType,
  username: '',
  email: '',
  senha: '',
  nomeCompleto: '',
  telefone: '',
  localId: '',
};

export function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

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
    const ehVendedor = form.tipo === 'VENDEDOR';
    if (ehVendedor && (!form.nomeCompleto.trim() || !form.localId)) {
      setErro('Para vendedor, informe o nome completo e a filial.');
      return;
    }
    setSalvando(true);
    try {
      await usuariosApi.criarUsuario({
        tipo: form.tipo,
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
    const acao = u.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o usuário "${u.username}"?`)) return;
    try {
      await usuariosApi.alterarAtivo(u.id, !u.ativo);
      carregar();
    } catch (e) {
      alert(
        axios.isAxiosError(e) && e.response?.data?.mensagem
          ? e.response.data.mensagem
          : 'Não foi possível alterar.',
      );
    }
  }

  async function resetarSenha(u: Usuario) {
    const senha = prompt(`Nova senha para "${u.username}" (mín. 6 caracteres):`);
    if (!senha) return;
    if (senha.length < 6) {
      alert('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    try {
      await usuariosApi.resetarSenha(u.id, senha);
      alert('Senha atualizada com sucesso.');
    } catch {
      alert('Não foi possível alterar a senha.');
    }
  }

  const ehVendedor = form.tipo === 'VENDEDOR';

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
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIPO_COR[u.type]}`}>
                      {TIPO_LABEL[u.type]}
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

      <Modal titulo="Novo usuário" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as UserType })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500"
            >
              <option value="VENDEDOR">Vendedor</option>
              <option value="ADMIN_COMERCIAL">Admin Comercial</option>
              <option value="ADMIN_TI">Admin TI</option>
            </select>
          </div>

          {ehVendedor && (
            <>
              <Campo
                label="Nome completo"
                value={form.nomeCompleto}
                onChange={(v) => setForm({ ...form, nomeCompleto: v })}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Filial</label>
                <select
                  value={form.localId}
                  onChange={(e) => setForm({ ...form, localId: e.target.value })}
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

          {erro && <p className="text-sm text-red-600">{erro}</p>}

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
