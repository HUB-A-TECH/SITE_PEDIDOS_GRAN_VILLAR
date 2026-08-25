import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Aviso } from '../../components/Aviso';
import * as tabelasApi from '../../lib/tabelasApi';
import type { TabelaPreco } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

/**
 * Pasta de tabelas de preço. Cada cliente pertence a uma tabela; mudar o preço
 * na tabela muda para todos os clientes dela de uma vez.
 */
export function AdminTabelasPage() {
  const navigate = useNavigate();
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    setTabelas(await tabelasApi.listarTodas());
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function aoSalvar(nova: TabelaPreco) {
    setModalAberto(false);
    navigate(`/admin/tabelas/${nova.id}`);
  }

  return (
    <AppLayout
      titulo="Tabelas de Preço"
      voltarPara="/"
      acao={
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500"
        >
          + Nova
        </button>
      }
    >
      <Aviso className="mb-4">
        Cada cliente usa uma tabela. Ao mudar um preço aqui, ele muda para todos
        os clientes daquela tabela.
      </Aviso>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {tabelas.map((t) => (
            <li
              key={t.id}
              className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${
                t.ativo ? 'border-brand-500' : 'border-slate-300'
              }`}
            >
              <button
                onClick={() => navigate(`/admin/tabelas/${t.id}`)}
                className="w-full text-left"
              >
                <p className="font-semibold text-slate-800">
                  {t.nome}
                  {!t.ativo && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                      desativada
                    </span>
                  )}
                </p>
                {t.descricao && (
                  <p className="text-sm text-slate-500">{t.descricao}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {t.totalClientes === 1
                    ? '1 cliente usa esta tabela'
                    : `${t.totalClientes ?? 0} clientes usam esta tabela`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo="Nova Tabela de Preço"
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <TabelaForm tabelas={tabelas} onSalvar={aoSalvar} />
      </Modal>
    </AppLayout>
  );
}

function TabelaForm({
  tabelas,
  onSalvar,
}: {
  tabelas: TabelaPreco[];
  onSalvar: (t: TabelaPreco) => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  // Duplicar já traz todos os preços prontos — é o caminho normal.
  const [duplicarDe, setDuplicarDe] = useState(
    tabelas.find((t) => t.ativo)?.id ?? '',
  );
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const nova = await tabelasApi.criar({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        duplicarDe: duplicarDe || undefined,
      });
      onSalvar(nova);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.mensagem) {
        setErro(err.response.data.mensagem);
      } else {
        setErro('Não foi possível criar a tabela.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Nome da tabela
        </span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex.: Tabela Atacado"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Descrição (opcional)
        </span>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: clientes que compram em volume"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Começar com os preços de
        </span>
        <select
          value={duplicarDe}
          onChange={(e) => setDuplicarDe(e.target.value)}
          className={inputCls}
        >
          {tabelas
            .filter((t) => t.ativo)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          <option value="">Começar do preço do catálogo</option>
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          A tabela nasce com esses preços; depois você ajusta só o que muda.
        </span>
      </label>

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
        {salvando ? 'Criando…' : 'Criar tabela'}
      </button>
    </form>
  );
}
