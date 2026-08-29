import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Aviso } from '../../components/Aviso';
import * as clientesApi from '../../lib/clientesApi';
import type { Local } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

/**
 * Dados da empresa (filial). O telefone daqui é o que sai no PDF do pedido —
 * é o contato da empresa, não o do vendedor.
 */
export function AdminFiliaisPage() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Local | null>(null);

  async function carregar() {
    setCarregando(true);
    setLocais(await clientesApi.listarLocais());
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const faltaTelefone = locais.some((l) => !l.telefone);

  return (
    <AppLayout titulo="Dados da Empresa" voltarPara="/">
      <Aviso className="mb-4">
        O telefone cadastrado aqui aparece no PDF do pedido que o vendedor
        entrega ao cliente.
      </Aviso>

      {!carregando && faltaTelefone && (
        <Aviso tom="atencao" className="mb-4" titulo="Telefone não cadastrado">
          Enquanto estiver vazio, o PDF sai sem a linha do telefone.
        </Aviso>
      )}

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {locais.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border-l-4 border-brand-500 bg-white p-4 shadow-sm"
            >
              <p className="font-semibold text-slate-800">{l.nome}</p>
              <p className="text-xs text-slate-500">{l.codigo}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <Linha rotulo="Telefone" valor={l.telefone} destacarVazio />
                <Linha rotulo="Endereço" valor={l.endereco} />
                <Linha rotulo="Responsável" valor={l.responsavel} />
              </dl>
              <button
                onClick={() => setEditando(l)}
                className="mt-3 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Editar dados
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo="Editar Dados da Empresa"
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
      >
        {editando && (
          <LocalForm
            local={editando}
            onSalvar={async () => {
              setEditando(null);
              await carregar();
            }}
          />
        )}
      </Modal>
    </AppLayout>
  );
}

function Linha({
  rotulo,
  valor,
  destacarVazio = false,
}: {
  rotulo: string;
  valor?: string | null;
  destacarVazio?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{rotulo}</dt>
      <dd
        className={
          valor
            ? 'text-slate-800'
            : destacarVazio
              ? 'text-brandYellow-800'
              : 'text-slate-400'
        }
      >
        {valor || 'não cadastrado'}
      </dd>
    </div>
  );
}

function LocalForm({
  local,
  onSalvar,
}: {
  local: Local;
  onSalvar: () => void;
}) {
  const [nome, setNome] = useState(local.nome);
  const [telefone, setTelefone] = useState(local.telefone ?? '');
  const [endereco, setEndereco] = useState(local.endereco ?? '');
  const [responsavel, setResponsavel] = useState(local.responsavel ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await clientesApi.atualizarLocal(local.id, {
        nome: nome.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        responsavel: responsavel.trim(),
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <Campo label="Nome da filial">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Telefone (aparece no PDF do pedido)">
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(00) 0000-0000"
          className={inputCls}
        />
      </Campo>
      <Campo label="Endereço (opcional)">
        <input
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          className={inputCls}
        />
      </Campo>
      <Campo label="Responsável (opcional)">
        <input
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className={inputCls}
        />
      </Campo>

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
