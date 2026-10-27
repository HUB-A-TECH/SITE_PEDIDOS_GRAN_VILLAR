import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { CampoQuantidade, PrecoItem } from '../../components/ItemEditors';
import { Aviso } from '../../components/Aviso';
import { useDialogo } from '../../context/DialogoContext';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Pedido } from '../../lib/pedidosApi';
import * as produtosApi from '../../lib/produtosApi';
import * as historicoApi from '../../lib/historicoApi';
import type { ItemHistoricoProduto } from '../../lib/historicoApi';
import {
  type Produto,
} from '../../lib/types';
import { useCategorias } from '../../lib/categoriasApi';

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
  const dialogo = useDialogo();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<string>('TODAS');
  const { categorias, nomeDe } = useCategorias();
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState('');
  const [salvo, setSalvo] = useState(false);
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
        if (!p || p.status === 'CANCELADO') {
          // Não encontrado ou cancelado: não é editável. Rascunho e pedido já
          // enviado (CONFIRMADO) podem ser abertos e editados.
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

  /** Folga entre a base do cabeçalho e o topo do card, ao pular de produto. */
  const FOLGA_APOS_CABECALHO = 12;

  /**
   * Produto que precisa ser realinhado quando o salvamento terminar. O card
   * recém-preenchido muda de altura quando o servidor responde (aparece o
   * subtotal), o que empurra a lista depois de já termos rolado.
   */
  const realinharAoSalvar = useRef<string | null>(null);

  /** Rola deixando o card do produto encostado embaixo do cabeçalho fixo. */
  function alinharCardNoTopo(produtoId: string) {
    const card = document.getElementById(`prod-${produtoId}`);
    if (!card) return;
    // Medido na hora, e não fixado em CSS, porque o cabeçalho muda de altura:
    // com nome de cliente comprido o título quebra em duas linhas, e um recuo
    // fixo deixaria o card escondido atrás dele.
    const alturaCabecalho =
      document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    const destino =
      card.getBoundingClientRect().top +
      window.scrollY -
      alturaCabecalho -
      FOLGA_APOS_CABECALHO;
    // Instantâneo (e não 'smooth') de propósito: o vendedor dispara Enter em
    // sequência, e uma animação interrompida pela próxima pode parar no meio
    // do caminho. Assim o card cai sempre no mesmo lugar.
    window.scrollTo({ top: Math.max(0, destino) });
  }

  /**
   * Enter no campo de quantidade: pula pro próximo produto da lista visível e
   * rola a tela deixando o card dele no TOPO, logo abaixo do cabeçalho fixo.
   *
   * A altura do cabeçalho é medida na hora, e não fixada em CSS, porque ela
   * muda: com nome de cliente comprido o título quebra em duas linhas e um
   * recuo fixo deixaria o card escondido atrás do cabeçalho.
   */
  function focarProximoProduto(produtoId: string) {
    const indice = visiveis.findIndex((p) => p.id === produtoId);
    const proximo = visiveis[indice + 1];
    if (!proximo) return;

    const input = document.getElementById(`qtd-${proximo.id}`) as HTMLInputElement | null;
    // preventScroll: sem isso o navegador faz o scroll dele primeiro (deixando
    // o campo rente ao teclado) e briga com o posicionamento abaixo.
    input?.focus({ preventScroll: true });
    input?.select();

    alinharCardNoTopo(proximo.id);
    realinharAoSalvar.current = proximo.id;
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
      // Só realinha se o pulo veio de um Enter — editar um campo solto não
      // deve mover a tela por conta própria.
      const alvo = realinharAoSalvar.current;
      if (alvo) {
        realinharAoSalvar.current = null;
        // setTimeout(0): espera o React aplicar o novo tamanho do card antes
        // de medir de novo.
        window.setTimeout(() => alinharCardNoTopo(alvo), 0);
      }
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
      // Só realinha se o pulo veio de um Enter — editar um campo solto não
      // deve mover a tela por conta própria.
      const alvo = realinharAoSalvar.current;
      if (alvo) {
        realinharAoSalvar.current = null;
        // setTimeout(0): espera o React aplicar o novo tamanho do card antes
        // de medir de novo.
        window.setTimeout(() => alinharCardNoTopo(alvo), 0);
      }
    }
  }

  async function salvarObs() {
    if (!pedido || obs === (pedido.observacoes ?? '')) return;
    const atualizado = await pedidosApi.atualizarObservacoes(pedido.id, obs);
    aplicarPedido(atualizado);
  }

  async function descartar() {
    if (!pedido) return;
    const ok = await dialogo.confirmar({
      titulo: 'Descartar pedido',
      destrutivo: true,
      textoConfirmar: 'Sim, descartar',
      mensagem: (
        <>
          Todo o pedido salvo para <strong>{pedido.cliente.nome}</strong> será
          apagado. <strong>Esta ação não pode ser desfeita.</strong>
        </>
      ),
    });
    if (!ok) return;
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
  const jaEnviado = pedido.status === 'CONFIRMADO';

  return (
    <AppLayout
      titulo={
        jaEnviado && pedido.numeroPedido
          ? `Pedido ${pedido.numeroPedido}`
          : `Pedido · ${pedido.cliente.nome}`
      }
      voltarPara="/meus-pedidos"
      acao={
        <div className="flex items-center gap-2">
          {salvo && <span className="text-xs text-brand-100">Salvo ✓</span>}
          <Link
            to={`/clientes/${pedido.clienteId}`}
            className="rounded-lg bg-brand-700 px-2.5 py-1.5 text-xs hover:bg-brand-800"
          >
            Perfil
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
          {categorias.map(({ id: c }) => (
            <Chip
              key={c}
              ativa={categoria === c}
              onClick={() => setCategoria(c)}
              label={nomeDe(c)}
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
                className={`rounded-xl bg-white p-4 shadow-sm transition ${
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
                .sort((a, b) => {
                  const ordem = (id: string | null) => {
                    const i = categorias.findIndex((c) => c.id === id);
                    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
                  };
                  return (
                    ordem(a.produto.categoria) - ordem(b.produto.categoria) ||
                    a.produto.nome.localeCompare(b.produto.nome)
                  );
                })
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

        {jaEnviado ? (
          <Aviso tom="dica" className="mt-4">
            Este pedido já foi enviado à administração. As alterações que você
            fizer aqui são salvas automaticamente.
          </Aviso>
        ) : (
          <Aviso tom="dica" titulo="Salvo automaticamente" className="mt-4">
            Este pedido ainda <strong>não</strong> foi para a administração. Ele
            fica em <strong>Meus Pedidos</strong>, na seção{' '}
            <strong>A confirmar</strong> — é de lá que você envia quando
            terminar a visita.
          </Aviso>
        )}

        {!jaEnviado && (
          <button
            onClick={descartar}
            className="mt-4 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Descartar pedido
          </button>
        )}
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
          </div>
          {jaEnviado ? (
            <button
              onClick={() => navigate('/meus-pedidos')}
              className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-500"
            >
              Concluir
            </button>
          ) : (
            <button
              onClick={() => navigate('/meus-pedidos')}
              disabled={totalItens === 0}
              className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Salvar e sair
            </button>
          )}
        </div>
      </div>

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
