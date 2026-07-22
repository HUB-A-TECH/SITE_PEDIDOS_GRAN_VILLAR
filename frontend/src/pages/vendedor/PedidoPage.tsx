import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { CampoQuantidade, PrecoItem } from '../../components/ItemEditors';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Pedido } from '../../lib/pedidosApi';
import * as produtosApi from '../../lib/produtosApi';
import * as historicoApi from '../../lib/historicoApi';
import type { ItemHistoricoProduto } from '../../lib/historicoApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
  type Produto,
} from '../../lib/types';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function diaMes(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${MESES_ABREV[d.getMonth()]}`;
}

export function PedidoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<Categoria | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ numero: string; pedidoId: string } | null>(null);
  const [histProdutos, setHistProdutos] = useState<Record<string, ItemHistoricoProduto[]>>({});
  const [histFechado, setHistFechado] = useState<Set<string>>(new Set());

  function aplicarPedido(p: Pedido) {
    setPedido(p);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1500);
  }

  function toggleHistorico(produtoId: string) {
    setHistFechado((s) => {
      const n = new Set(s);
      if (n.has(produtoId)) n.delete(produtoId);
      else n.add(produtoId);
      return n;
    });
  }

  function irParaProduto(produtoId: string) {
    const el = document.getElementById(`prod-${produtoId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-brand-500');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-brand-500'), 1600);
  }

  useEffect(() => {
    if (!id) {
      navigate('/meus-pedidos', { replace: true });
      return;
    }
    pedidosApi
      .obterPedido(id)
      .then(async (p) => {
        if (!p || p.status !== 'RASCUNHO') {
          // Não encontrado, ou já enviado/cancelado: não é mais editável aqui.
          navigate('/meus-pedidos', { replace: true });
          return;
        }
        setPedido(p);
        setObs(p.observacoes ?? '');
        // Mix e histórico por produto em paralelo (mais rápido).
        const [mix, hist] = await Promise.all([
          produtosApi.listarPorMix(p.clienteId),
          historicoApi.historicoItens(p.clienteId),
        ]);
        setProdutos(mix);
        setHistProdutos(hist);
      })
      .finally(() => setCarregando(false));
  }, [id, navigate]);

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

  /** Enter no campo de quantidade pula pro próximo produto da lista visível. */
  function focarProximoProduto(produtoId: string) {
    const indice = visiveis.findIndex((p) => p.id === produtoId);
    const proximo = visiveis[indice + 1];
    if (!proximo) return;
    const input = document.getElementById(`qtd-${proximo.id}`) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }

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

  async function definirPreco(produtoId: string, precoUnitario: number) {
    if (!pedido) return;
    const item = itemPorProduto.get(produtoId);
    if (!item) return;
    setProcessando((s) => new Set(s).add(produtoId));
    try {
      const atualizado = await pedidosApi.atualizarPrecoItem(pedido.id, item.id, precoUnitario);
      aplicarPedido(atualizado);
    } finally {
      setProcessando((s) => {
        const n = new Set(s);
        n.delete(produtoId);
        return n;
      });
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
      setConfirmado({ numero: numeroPedido, pedidoId: pedido.id });
    } catch {
      alert('Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function baixarProposta() {
    if (!pedido || pedido.itens.length === 0) return;
    await salvarObs(); // garante que as observações estejam salvas no PDF
    const a = document.createElement('a');
    a.href = pedidosApi.pdfHref(pedido.id);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function descartar() {
    if (!pedido) return;
    if (!confirm('Descartar este pedido salvo? Esta ação não pode ser desfeita.')) return;
    await pedidosApi.descartar(pedido.id);
    navigate('/meus-pedidos', { replace: true });
  }

  if (carregando || !pedido) {
    return (
      <AppLayout titulo="Pedido" voltarPara="/meus-pedidos">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }

  const totalItens = pedido.itens.length;

  return (
    <AppLayout
      titulo={`Pedido · ${pedido.cliente.nome}`}
      voltarPara="/meus-pedidos"
      acao={
        <div className="flex items-center gap-2">
          {salvo && <span className="text-xs text-brand-100">Salvo ✓</span>}
          <Link
            to={`/clientes/${pedido.clienteId}/historico`}
            className="rounded-lg bg-brand-700 px-2.5 py-1.5 text-xs hover:bg-brand-800"
          >
            Histórico
          </Link>
        </div>
      }
    >
      <div className="pb-52">
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
                id={`prod-${p.id}`}
                className={`scroll-mt-20 rounded-xl bg-white p-4 shadow-sm transition ${
                  qtd > 0 ? 'ring-1 ring-brand-300' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{p.nome}</p>
                    {qtd > 0 && item ? (
                      <PrecoItem
                        precoCatalogo={p.preco}
                        precoAtual={item.precoUnitario}
                        unidade={p.unidadeMedida}
                        desabilitado={ocupado}
                        onChange={(v) => definirPreco(p.id, v)}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        {brl(p.preco)} / {p.unidadeMedida}
                      </p>
                    )}
                  </div>
                  {qtd > 0 && (
                    <p className="text-sm font-semibold text-slate-700">
                      {brl(item!.subtotal)}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <CampoQuantidade
                    id={`qtd-${p.id}`}
                    valor={qtd}
                    unidade={p.unidadeMedida}
                    desabilitado={ocupado}
                    onChange={(v) => definirQuantidade(p.id, v)}
                    onEnter={() => focarProximoProduto(p.id)}
                  />
                </div>

                {histProdutos[p.id]?.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <button
                      onClick={() => toggleHistorico(p.id)}
                      className="flex w-full items-center justify-between text-xs font-semibold text-brand-700"
                    >
                      <span>Histórico do produto</span>
                      <span className="text-slate-400">
                        {histFechado.has(p.id)
                          ? `▸ ver (${histProdutos[p.id].length})`
                          : '▾ ocultar'}
                      </span>
                    </button>
                    {!histFechado.has(p.id) && (
                      <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 sm:grid-cols-6">
                        {histProdutos[p.id].map((e, i) => (
                          <div key={i} className="text-center">
                            <p className="text-[11px] font-medium leading-tight text-slate-500">
                              {diaMes(e.data)}
                            </p>
                            <p className="text-sm font-bold leading-tight text-brand-700">
                              {e.quantidade}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {pedido.itens.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-bold text-slate-700">
              Resumo do pedido
            </h3>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              {[...pedido.itens]
                .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome))
                .map((it, idx) => (
                  <div
                    key={it.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      idx > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <button
                      onClick={() => irParaProduto(it.produtoId)}
                      aria-label={`Ir para ${it.produto.nome}`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {it.produto.nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        {it.quantidade} {it.produto.unidadeMedida}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-700">
                      {brl(it.subtotal)}
                    </p>
                  </div>
                ))}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-bold text-slate-700">Total</p>
                <p className="text-base font-bold text-brand-700">
                  {brl(pedido.total)}
                </p>
              </div>
            </div>
          </div>
        )}

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

        <div className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
          💡 O pedido é salvo automaticamente. Toque em <strong>Baixar PDF</strong>{' '}
          para o cliente conferir. Quando ele aprovar, use{' '}
          <strong>Salvar e Enviar</strong> para mandar à administração.
        </div>

        <button
          onClick={descartar}
          className="mt-4 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Descartar pedido
        </button>
      </div>

      {/* Barra fixa de ações */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-md space-y-2 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500">
                {totalItens} {totalItens === 1 ? 'item' : 'itens'} · salvo automaticamente
              </p>
              <p className="text-lg font-bold text-slate-800">{brl(pedido.total)}</p>
            </div>
            <button
              onClick={baixarProposta}
              disabled={totalItens === 0}
              className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
            >
              Baixar PDF
            </button>
          </div>
          <button
            onClick={enviarPedido}
            disabled={enviando || totalItens === 0}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {enviando ? 'Enviando…' : 'Salvar e Enviar (para a administração)'}
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
              className="block w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-500"
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
        ativa ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
