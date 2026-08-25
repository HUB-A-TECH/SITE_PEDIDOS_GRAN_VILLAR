import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Aviso } from '../../components/Aviso';
import * as tabelasApi from '../../lib/tabelasApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
  type TabelaDetalhe,
  type TabelaPreco,
  type TabelaProduto,
} from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const campoId = (produtoId: string) => `preco-${produtoId}`;

/**
 * Preços de uma tabela, em grade tipo planilha: digita o valor, Enter confirma
 * e pula para o próximo produto da lista. Cada preço salvo vale na hora para
 * todos os clientes da tabela.
 */
export function AdminTabelaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<TabelaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Categoria | 'TODAS'>('TODAS');
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (!id) return;
    tabelasApi.detalhe(id).then((d) => {
      setDados(d);
      setCarregando(false);
    });
  }, [id]);

  const visiveis = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    return dados.produtos.filter(
      (p) =>
        (filtro === 'TODAS' || p.categoria === filtro) &&
        (!termo ||
          p.nome.toLowerCase().includes(termo) ||
          p.codigo.toLowerCase().includes(termo)),
    );
  }, [dados, busca, filtro]);

  async function salvarPreco(produto: TabelaProduto, preco: number) {
    if (!id || !dados) return;
    await tabelasApi.definirPreco(id, produto.id, preco);
    setDados({
      ...dados,
      produtos: dados.produtos.map((p) =>
        p.id === produto.id ? { ...p, preco, definido: true } : p,
      ),
    });
  }

  /** Enter salva e leva o foco pro próximo produto visível (estilo planilha). */
  function focarProximo(produtoId: string) {
    const i = visiveis.findIndex((p) => p.id === produtoId);
    const proximo = visiveis[i + 1];
    if (!proximo) return;
    document.getElementById(campoId(proximo.id))?.focus();
  }

  if (carregando || !dados) {
    return (
      <AppLayout titulo="Tabela de Preço" voltarPara="/admin/tabelas">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }

  const totalClientes = dados.clientes.length;

  return (
    <AppLayout
      titulo={dados.tabela.nome}
      voltarPara="/admin/tabelas"
      acao={
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500"
        >
          Editar
        </button>
      }
    >
      {!dados.tabela.ativo && (
        <Aviso className="mb-3" titulo="Tabela desativada">
          Não aparece para escolher no cadastro de cliente. Quem já está nela
          continua usando estes preços.
        </Aviso>
      )}

      <Aviso
        tom="atencao"
        className="mb-3"
        titulo={`Mudar um preço aqui afeta ${
          totalClientes === 1 ? '1 cliente' : `${totalClientes} clientes`
        }.`}
        acao={
          <button
            onClick={() => setMostrarClientes((v) => !v)}
            className="font-medium underline decoration-dotted"
          >
            {mostrarClientes ? 'ocultar a lista' : 'ver quais'}
          </button>
        }
      >
        O novo preço passa a valer na hora para todos eles.
      </Aviso>

      {mostrarClientes && (
        <ul className="mb-3 space-y-1 rounded-lg bg-white p-3 shadow-sm">
          {totalClientes === 0 ? (
            <li className="text-sm text-slate-500">
              Nenhum cliente usa esta tabela ainda.
            </li>
          ) : (
            dados.clientes.map((c) => (
              <li key={c.id} className="text-sm text-slate-700">
                {c.nome}
                {c.nomeFantasia ? ` · ${c.nomeFantasia}` : ''}
                {!c.ativo && (
                  <span className="ml-1 text-xs text-slate-400">(inativo)</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}

      <input
        type="search"
        placeholder="Buscar por nome ou código…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className={`${inputCls} mb-3`}
      />
      <select
        value={filtro}
        onChange={(e) => setFiltro(e.target.value as Categoria | 'TODAS')}
        className={`${inputCls} mb-4`}
      >
        <option value="TODAS">Todas as categorias</option>
        {CATEGORIAS.map((c) => (
          <option key={c} value={c}>
            {CATEGORIA_LABEL[c]}
          </option>
        ))}
      </select>

      <p className="mb-2 text-xs text-slate-500">
        {visiveis.length} produto{visiveis.length === 1 ? '' : 's'} · digite o
        preço e aperte Enter para ir ao próximo.
      </p>

      <ul className="space-y-2">
        {visiveis.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{p.nome}</p>
              <p className="text-xs text-slate-500">
                {p.codigo} · {p.unidadeMedida}
                {p.preco !== p.precoCatalogo && (
                  <span className="ml-1 text-slate-400">
                    (catálogo: {brl(p.precoCatalogo)})
                  </span>
                )}
              </p>
            </div>
            <CampoPreco
              id={campoId(p.id)}
              preco={p.preco}
              onSalvar={(v) => salvarPreco(p, v)}
              onEnter={() => focarProximo(p.id)}
            />
          </li>
        ))}
      </ul>

      <Modal
        titulo="Editar Tabela"
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <TabelaEditForm
          tabela={dados.tabela}
          onSalvar={(t) => {
            setDados({ ...dados, tabela: { ...dados.tabela, ...t } });
            setModalAberto(false);
          }}
        />
      </Modal>
    </AppLayout>
  );
}

function TabelaEditForm({
  tabela,
  onSalvar,
}: {
  tabela: TabelaPreco;
  onSalvar: (t: TabelaPreco) => void;
}) {
  const [nome, setNome] = useState(tabela.nome);
  const [descricao, setDescricao] = useState(tabela.descricao ?? '');
  const [ativo, setAtivo] = useState(tabela.ativo);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      onSalvar(
        await tabelasApi.atualizar(tabela.id, {
          nome: nome.trim(),
          descricao: descricao.trim(),
          ativo,
        }),
      );
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
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Descrição
        </span>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Ativa (aparece para escolher no cadastro de cliente)
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
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

/** Campo de preço da grade: salva no blur, Enter confirma e pula. */
function CampoPreco({
  id,
  preco,
  onSalvar,
  onEnter,
}: {
  id: string;
  preco: number;
  onSalvar: (v: number) => void;
  onEnter: () => void;
}) {
  const [texto, setTexto] = useState(String(preco));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setTexto(String(preco)), [preco]);

  async function commit() {
    const n = Number(texto.trim().replace(',', '.'));
    if (Number.isNaN(n) || n < 0) {
      setTexto(String(preco));
      return;
    }
    if (n === preco) return;
    setSalvando(true);
    try {
      await onSalvar(Math.round(n * 100) / 100);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="text-xs text-slate-400">R$</span>
      <input
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget.blur();
          onEnter();
        }}
        inputMode="decimal"
        disabled={salvando}
        className="h-10 w-24 rounded-lg border border-slate-300 text-center outline-none focus:border-brand-500 disabled:opacity-60"
      />
    </div>
  );
}
