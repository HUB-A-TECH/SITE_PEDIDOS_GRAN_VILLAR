import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Pedido } from '../../lib/pedidosApi';
import * as produtosApi from '../../lib/produtosApi';
import * as historicoApi from '../../lib/historicoApi';
import type { ProdutoHistorico } from '../../lib/historicoApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
  type Produto,
} from '../../lib/types';

const CACHE_KEY = 'gv_rascunho';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PedidoPage() {
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<Categoria | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [sugestoes, setSugestoes] = useState<ProdutoHistorico[]>([]);
  const [popupHistorico, setPopupHistorico] = useState(false);
  const [aplicandoHistorico, setAplicandoHistorico] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ numero: string; pedidoId: string } | null>(null);

  function aplicarPedido(p: Pedido) {
    setPedido(p);
    localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1500);
  }

  useEffect(() => {
    pedidosApi
      .obterRascunho()
      .then(async (p) => {
        if (!p) {
          navigate('/clientes', { replace: true });
          return;
        }
        setPedido(p);
        setObs(p.observacoes ?? '');
        const mix = await produtosApi.listarPorMix(p.clienteId);
        setProdutos(mix);
        // Rascunho novo/vazio: oferece preencher pelo histórico.
        if (p.itens.length === 0) {
          const freq = await historicoApi.produtosHistorico(p.clienteId, 6);
          if (freq.length > 0) {
            setSugestoes(freq);
            setPopupHistorico(true);
          }
        }
      })
      .finally(() => setCarregando(false));
  }, [navigate]);

  const itemPorProduto = useMemo(() => {
    const m = new Map<string, Pedido['itens'][number]>();
    pedido?.itens.forEach((i) => m.set(i.produtoId, i));
    return m;
  }, [pedido]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const okCat = categoria === 'TODAS' || p.categoria === categoria;
      const okBusca =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        p.codigo.toLowerCase().includes(termo);
      return okCat && okBusca;
    });
  }, [produtos, categoria, busca]);

  async function definirQuantidade(produtoId: string, quantidade: number) {
    if (!pedido) return;
    setProcessando((s) => new Set(s).add(produtoId));
    try {
      const item = itemPorProduto.get(produtoId);
      let atualizado: Pedido;
      if (quantidade <= 0) {
        if (!item) return;
        atualizado = await pedidosApi.removerItem(pedido.id, item.id);
      } else if (item) {
        atualizado = await pedidosApi.atualizarItem(pedido.id, item.id, quantidade);
      } else {
        atualizado = await pedidosApi.adicionarItem(pedido.id, produtoId, quantidade);
      }
      aplicarPedido(atualizado);
    } finally {
      setProcessando((s) => {
        const n = new Set(s);
        n.delete(produtoId);
        return n;
      });
    }
  }

  async function usarHistorico() {
    if (!pedido) return;
    setAplicandoHistorico(true);
    try {
      for (const s of sugestoes) {
        await pedidosApi.adicionarItem(pedido.id, s.produtoId, s.quantidadeUltima);
      }
      const atualizado = await pedidosApi.obterRascunho();
      if (atualizado) aplicarPedido(atualizado);
      setPopupHistorico(false);
    } finally {
      setAplicandoHistorico(false);
    }
  }

  async function salvarObs() {
    if (!pedido || obs === (pedido.observacoes ?? '')) return;
    const atualizado = await pedidosApi.atualizarObservacoes(pedido.id, obs);
    aplicarPedido(atualizado);
  }

  async function enviarPedido() {
    if (!pedido || pedido.itens.length === 0) return;
    setEnviando(true);
    try {
      const { numeroPedido } = await pedidosApi.confirmar(pedido.id);
      localStorage.removeItem(CACHE_KEY);
      setConfirmado({ numero: numeroPedido, pedidoId: pedido.id });
    } catch {
      alert('Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function descartar() {
    if (!pedido) return;
    if (!confirm('Descartar este rascunho? Esta ação não pode ser desfeita.')) return;
    await pedidosApi.descartar(pedido.id);
    localStorage.removeItem(CACHE_KEY);
    navigate('/clientes', { replace: true });
  }

  if (carregando || !pedido) {
    return (
      <AppLayout titulo="Pedido" voltarPara="/clientes">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }

  const totalItens = pedido.itens.length;

  return (
    <AppLayout
      titulo={`Pedido · ${pedido.cliente.nome}`}
      voltarPara="/clientes"
      acao={
        <div className="flex items-center gap-2">
          {salvo && <span className="text-xs text-emerald-300">Salvo ✓</span>}
          <Link
            to={`/clientes/${pedido.clienteId}/historico`}
            className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs hover:bg-slate-600"
          >
            Histórico
          </Link>
        </div>
      }
    >
      <Modal
        titulo="Usar histórico?"
        aberto={popupHistorico}
        onFechar={() => setPopupHistorico(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Este cliente costuma comprar estes produtos. Quer preencher o pedido
            com as <strong>últimas quantidades</strong>? Você pode ajustar depois.
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto text-sm">
            {sugestoes.map((s) => (
              <li key={s.produtoId} className="flex justify-between">
                <span className="text-slate-700">{s.nome}</span>
                <span className="font-medium text-slate-800">
                  {s.quantidadeUltima} {s.unidadeMedida}
                  <span className="ml-1 text-xs text-slate-400">
                    ({s.numeroCompras}x)
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={usarHistorico}
            disabled={aplicandoHistorico}
            className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {aplicandoHistorico
              ? 'Preenchendo…'
              : `Usar histórico (${sugestoes.length} itens)`}
          </button>
          <button
            onClick={() => setPopupHistorico(false)}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Começar vazio
          </button>
        </div>
      </Modal>

      <div className="pb-40">
        <input
          type="search"
          placeholder="Buscar produto no mix…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <Chip ativa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} label="Todas" />
          {CATEGORIAS.map((c) => (
            <Chip
              key={c}
              ativa={categoria === c}
              onClick={() => setCategoria(c)}
              label={CATEGORIA_LABEL[c]}
            />
          ))}
        </div>

        <ul className="space-y-2">
          {visiveis.map((p) => {
            const item = itemPorProduto.get(p.id);
            const qtd = item?.quantidade ?? 0;
            const ocupado = processando.has(p.id);
            return (
              <li
                key={p.id}
                className={`rounded-xl bg-white p-4 shadow-sm ${
                  qtd > 0 ? 'ring-1 ring-emerald-300' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{p.nome}</p>
                    <p className="text-xs text-slate-500">
                      {brl(p.preco)} / {p.unidadeMedida}
                    </p>
                  </div>
                  {qtd > 0 && (
                    <p className="text-sm font-semibold text-slate-700">
                      {brl(item!.subtotal)}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  {qtd > 0 ? (
                    <ControleQuantidade
                      valor={qtd}
                      unidade={p.unidadeMedida}
                      desabilitado={ocupado}
                      onChange={(v) => definirQuantidade(p.id, v)}
                    />
                  ) : (
                    <button
                      onClick={() => definirQuantidade(p.id, 1)}
                      disabled={ocupado}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Observações
          </label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={salvarObs}
            rows={3}
            placeholder="Ex.: entregar de manhã, embalagem a vácuo…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </div>

        <button
          onClick={descartar}
          className="mt-4 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Descartar rascunho
        </button>
      </div>

      {/* Barra fixa de total */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 p-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </p>
            <p className="text-lg font-bold text-slate-800">{brl(pedido.total)}</p>
          </div>
          <button
            onClick={enviarPedido}
            disabled={enviando || totalItens === 0}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {enviando ? 'Enviando…' : 'Salvar e Enviar'}
          </button>
        </div>
      </div>

      <Modal
        titulo="Pedido enviado!"
        aberto={confirmado !== null}
        onFechar={() => navigate('/meus-pedidos', { replace: true })}
      >
        {confirmado && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <p className="text-slate-700">
              Pedido <strong>{confirmado.numero}</strong> confirmado com sucesso.
            </p>
            <a
              href={pedidosApi.pdfHref(confirmado.pedidoId)}
              target="_blank"
              rel="noopener"
              className="block w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500"
            >
              Baixar PDF (entregar ao cliente)
            </a>
            <a
              href={pedidosApi.txtHref(confirmado.pedidoId)}
              className="block w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Baixar TXT
            </a>
            <button
              onClick={() => navigate('/meus-pedidos', { replace: true })}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Concluir
            </button>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}

function ControleQuantidade({
  valor,
  unidade,
  desabilitado,
  onChange,
}: {
  valor: number;
  unidade: string;
  desabilitado: boolean;
  onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);

  function commit() {
    const n = Number(texto.replace(',', '.'));
    if (!Number.isNaN(n) && n !== valor) onChange(n);
    else setTexto(String(valor));
  }

  const btn =
    'h-9 w-9 rounded-lg bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={desabilitado}
        onClick={() => onChange(Math.max(0, Math.round((valor - 1) * 1000) / 1000))}
        className={btn}
      >
        −
      </button>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal"
        disabled={desabilitado}
        className="h-9 w-16 rounded-lg border border-slate-300 text-center outline-none focus:border-slate-500"
      />
      <button
        type="button"
        disabled={desabilitado}
        onClick={() => onChange(valor + 1)}
        className={btn}
      >
        +
      </button>
      <span className="text-xs text-slate-400">{unidade}</span>
      <button
        type="button"
        disabled={desabilitado}
        onClick={() => onChange(0)}
        className="ml-auto text-sm text-red-500 hover:underline disabled:opacity-50"
      >
        remover
      </button>
    </div>
  );
}

function Chip({
  ativa,
  onClick,
  label,
}: {
  ativa: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        ativa ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
