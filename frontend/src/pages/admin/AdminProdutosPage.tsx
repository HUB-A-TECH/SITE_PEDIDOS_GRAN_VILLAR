import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import * as produtosApi from '../../lib/produtosApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  UNIDADES,
  type Categoria,
  type Produto,
} from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

export function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Categoria | 'TODAS'>('TODAS');
  const [editando, setEditando] = useState<Produto | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    const lista = await produtosApi.adminListar(
      filtro === 'TODAS' ? undefined : filtro,
    );
    setProdutos(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEdicao(p: Produto) {
    setEditando(p);
    setModalAberto(true);
  }
  async function aoSalvar() {
    setModalAberto(false);
    await carregar();
  }

  return (
    <AppLayout
      titulo="Produtos (Catálogo)"
      voltarPara="/"
      acao={
        <button
          onClick={abrirNovo}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500"
        >
          + Novo
        </button>
      }
    >
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

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum produto.</p>
      ) : (
        <ul className="space-y-2">
          {produtos.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  {p.nome}{' '}
                  {!p.ativo && (
                    <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                      inativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {p.codigo} · {CATEGORIA_LABEL[p.categoria]} ·{' '}
                  {p.preco.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                  /{p.unidadeMedida}
                </p>
              </div>
              <button
                onClick={() => abrirEdicao(p)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo={editando ? 'Editar Produto' : 'Novo Produto'}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <ProdutoForm produto={editando} onSalvar={aoSalvar} />
      </Modal>
    </AppLayout>
  );
}

function ProdutoForm({
  produto,
  onSalvar,
}: {
  produto: Produto | null;
  onSalvar: () => void;
}) {
  const [codigo, setCodigo] = useState(produto?.codigo ?? '');
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [categoria, setCategoria] = useState<Categoria>(
    produto?.categoria ?? 'ALHOS',
  );
  const [preco, setPreco] = useState(produto ? String(produto.preco) : '');
  const [unidade, setUnidade] = useState(produto?.unidadeMedida ?? 'UND');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const precoNum = Number(preco.replace(',', '.'));
    if (Number.isNaN(precoNum) || precoNum < 0) {
      setErro('Preço inválido.');
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        codigo: codigo.trim(),
        nome: nome.trim(),
        categoria,
        preco: precoNum,
        unidadeMedida: unidade,
        descricao: descricao.trim() || undefined,
      };
      if (produto) {
        await produtosApi.adminAtualizar(produto.id, { ...dados, ativo });
      } else {
        await produtosApi.adminCriar(dados);
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
      <Campo label="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Categoria">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
            className={inputCls}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Unidade">
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className={inputCls}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Preço (R$)">
        <input
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Descrição (opcional)">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={inputCls}
        />
      </Campo>

      {produto && (
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
