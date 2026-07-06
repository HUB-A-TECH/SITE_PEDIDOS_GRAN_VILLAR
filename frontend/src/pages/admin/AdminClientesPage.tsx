import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import * as clientesApi from '../../lib/clientesApi';
import type { Cliente, Local } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

export function AdminClientesPage() {
  const navigate = useNavigate();
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    clientesApi.listarLocais().then((ls) => {
      setLocais(ls);
      if (ls.length > 0) setLocalId(ls[0].id);
    });
  }, []);

  async function carregar(id: string) {
    if (!id) return;
    setCarregando(true);
    const lista = await clientesApi.adminListar(id);
    setClientes(lista);
    setCarregando(false);
  }

  useEffect(() => {
    if (localId) carregar(localId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEdicao(c: Cliente) {
    setEditando(c);
    setModalAberto(true);
  }
  async function aoSalvar() {
    setModalAberto(false);
    await carregar(localId);
  }

  return (
    <AppLayout
      titulo="Clientes"
      voltarPara="/"
      acao={
        <button
          onClick={abrirNovo}
          disabled={!localId}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          + Novo
        </button>
      }
    >
      <select
        value={localId}
        onChange={(e) => setLocalId(e.target.value)}
        className={`${inputCls} mb-4`}
      >
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome} ({l.codigo})
          </option>
        ))}
      </select>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum cliente neste local.</p>
      ) : (
        <ul className="space-y-2">
          {clientes.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    {c.nome}{' '}
                    {!c.ativo && (
                      <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
                    {c.codigo}
                  </p>
                </div>
                <button
                  onClick={() => abrirEdicao(c)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Editar
                </button>
              </div>
              <button
                onClick={() => navigate(`/admin/clientes/${c.id}/mix`)}
                className="mt-3 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Gerenciar mix de produtos →
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo={editando ? 'Editar Cliente' : 'Novo Cliente'}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <ClienteForm
          cliente={editando}
          localId={localId}
          onSalvar={aoSalvar}
        />
      </Modal>
    </AppLayout>
  );
}

function ClienteForm({
  cliente,
  localId,
  onSalvar,
}: {
  cliente: Cliente | null;
  localId: string;
  onSalvar: () => void;
}) {
  const [codigo, setCodigo] = useState(cliente?.codigo ?? '');
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia ?? '');
  const [cnpj, setCnpj] = useState(cliente?.cnpj ?? '');
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '');
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const dados = {
        codigo: codigo.trim(),
        nome: nome.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || undefined,
      };
      if (cliente) {
        await clientesApi.adminAtualizar(cliente.id, { ...dados, ativo });
      } else {
        await clientesApi.adminCriar({ ...dados, localId });
      }
      onSalvar();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.mensagem) {
        setErro(err.response.data.mensagem);
      } else {
        setErro('Não foi possível salvar.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Campo label="Código">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Nome / Razão social">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Nome fantasia (opcional)">
        <input
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          className={inputCls}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="CNPJ (opcional)">
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefone (opcional)">
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      {cliente && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          Ativo
        </label>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
