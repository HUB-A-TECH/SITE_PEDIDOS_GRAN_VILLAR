import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlocker, useParams } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { AlteracoesComercial } from '../../components/AlteracoesComercial';
import { CampoQuantidade, PrecoItem } from '../../components/ItemEditors';
import * as pedidosApi from '../../lib/pedidosApi';
import type { PedidoAdminDetalhe } from '../../lib/pedidosApi';
import { estiloStatus } from '../../lib/statusPedido';
import { useDialogo } from '../../context/DialogoContext';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const subtotal = (q: number, p: number) => Math.round(q * p * 100) / 100;

/** Quantidade e preço de cada item (por id) num momento da revisão. */
type Estado = Record<string, { quantidade: number; precoUnitario: number }>;

function estadoDoPedido(p: PedidoAdminDetalhe): Estado {
  return Object.fromEntries(
    p.itens.map((i) => [i.id, { quantidade: i.quantidade, precoUnitario: i.precoUnitario }]),
  );
}

const mesmoItem = (a: Estado[string], b: Estado[string]) =>
  a.quantidade === b.quantidade && a.precoUnitario === b.precoUnitario;

/**
 * Revisão do pedido pelo comercial. As mudanças ficam num rascunho, só nesta
 * tela, até "Confirmar pedido com alterações" — antes disso o vendedor não vê
 * nada. Desfazer/refazer andam uma alteração por vez; "Descartar alterações"
 * volta tudo como o vendedor deixou (e também pode ser desfeito).
 */
export function AdminPedidoDetalhePage() {
  const { id = '' } = useParams();
  const dialogo = useDialogo();
  const [pedido, setPedido] = useState<PedidoAdminDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [historicoVisivel, setHistoricoVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Pilha de estados da revisão: [0] = como o vendedor deixou.
  const [passos, setPassos] = useState<Estado[]>([]);
  const [posicao, setPosicao] = useState(0);

  /** Recomeça a revisão a partir do pedido como está no servidor. */
  const iniciar = useCallback((p: PedidoAdminDetalhe) => {
    setPedido(p);
    setPassos([estadoDoPedido(p)]);
    setPosicao(0);
  }, []);

  const carregar = useCallback(() => {
    setCarregando(true);
    return pedidosApi
      .adminObterPedido(id)
      .then(iniciar)
      .finally(() => setCarregando(false));
  }, [id, iniciar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const base = passos[0];
  const atual = passos[posicao];

  /** Itens mudados em relação ao que o vendedor enviou. */
  const mudados = useMemo(() => {
    if (!base || !atual) return new Set<string>();
    return new Set(Object.keys(base).filter((k) => !mesmoItem(base[k], atual[k])));
  }, [base, atual]);
  const temMudancas = mudados.size > 0;

  // ---- Aviso antes de sair com alterações não confirmadas ----
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      temMudancas && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    dialogo
      .confirmar({
        titulo: 'Sair sem confirmar?',
        destrutivo: true,
        textoConfirmar: 'Sair sem confirmar',
        mensagem: `Você tem ${mudados.size === 1 ? '1 alteração' : `${mudados.size} alterações`} que ainda não ${
          mudados.size === 1 ? 'foi confirmada' : 'foram confirmadas'
        }. Se sair, ${mudados.size === 1 ? 'ela será perdida' : 'elas serão perdidas'} e o pedido fica como o vendedor deixou.`,
      })
      .then((sair) => (sair ? blocker.proceed() : blocker.reset()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);
  useEffect(() => {
    if (!temMudancas) return;
    // Fechar a aba / recarregar: o navegador mostra o aviso padrão dele.
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [temMudancas]);

  if (carregando || !pedido || !base || !atual) {
    return (
      <AppLayout titulo="Pedido" voltarPara="/admin/pedidos">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }

  const podeEditar = pedido.status === 'CONFIRMADO';
  const comAlteracoes = pedido.alteracoesComercial.length > 0;
  const est = estiloStatus(pedido.status, pedido.revisao, comAlteracoes);
  const precisaRevisao = pedido.revisao === 'PENDENTE' || pedido.revisao === 'ALTERADO';

  /** Registra um novo passo (apaga o "refazer" que havia à frente). */
  function registrar(novo: Estado) {
    if (Object.keys(novo).every((k) => mesmoItem(novo[k], atual[k]))) return;
    setPassos((ps) => [...ps.slice(0, posicao + 1), novo]);
    setPosicao((p) => p + 1);
  }
  function alterar(itemId: string, campo: 'quantidade' | 'precoUnitario', valor: number) {
    registrar({ ...atual, [itemId]: { ...atual[itemId], [campo]: valor } });
  }
  function voltarItem(itemId: string) {
    registrar({ ...atual, [itemId]: base[itemId] });
  }
  function descartarTudo() {
    registrar(base);
  }

  const totalAtual =
    Math.round(
      Object.values(atual).reduce(
        (s, i) => s + (i.quantidade > 0 ? subtotal(i.quantidade, i.precoUnitario) : 0),
        0,
      ) * 100,
    ) / 100;
  const semItens = Object.values(atual).every((i) => i.quantidade <= 0);

  function erroDe(e: unknown, padrao: string) {
    return axios.isAxiosError(e) && e.response?.data?.mensagem ? e.response.data.mensagem : padrao;
  }

  async function aprovar() {
    setEnviando(true);
    try {
      iniciar(await pedidosApi.adminAprovar(pedido!.id));
    } catch (e) {
      await dialogo.avisar({ titulo: 'Não foi possível aprovar', tom: 'erro', mensagem: erroDe(e, 'Tente novamente.') });
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarComAlteracoes() {
    setEnviando(true);
    try {
      const itens = pedido!.itens.map((i) => ({
        itemId: i.id,
        quantidadeBase: base[i.id].quantidade,
        precoBase: base[i.id].precoUnitario,
        quantidade: atual[i.id].quantidade,
        precoUnitario: atual[i.id].precoUnitario,
      }));
      iniciar(await pedidosApi.adminRevisar(pedido!.id, itens));
      await dialogo.avisar({
        titulo: 'Pedido aprovado com alterações',
        tom: 'dica',
        mensagem: 'O vendedor vai ver no pedido o que foi alterado.',
      });
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        // O vendedor mexeu no pedido enquanto a revisão acontecia.
        await dialogo.avisar({ titulo: 'O pedido mudou', tom: 'atencao', mensagem: erroDe(e, '') });
        await carregar();
        return;
      }
      await dialogo.avisar({ titulo: 'Não foi possível confirmar', tom: 'erro', mensagem: erroDe(e, 'Tente novamente.') });
    } finally {
      setEnviando(false);
    }
  }

  const podeDesfazer = posicao > 0;
  const podeRefazer = posicao < passos.length - 1;
  const mostraPainel = podeEditar && (temMudancas || podeDesfazer || podeRefazer);

  return (
    <AppLayout
      titulo={pedido.numeroPedido ? `Pedido ${pedido.numeroPedido}` : 'Pedido'}
      voltarPara="/admin/pedidos"
    >
      <div className={mostraPainel ? 'pb-56' : ''}>
        <div className={`mb-4 rounded-xl border-l-4 bg-white p-4 shadow-sm ${est.borderClass}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{pedido.cliente.nome}</p>
            <span className={`text-right text-xs font-medium ${est.textClass}`}>{est.label}</span>
          </div>
          <p className="text-xs text-slate-500">
            {pedido.vendedor.nomeCompleto} · {dataBR(pedido.data)}
          </p>
          <button
            onClick={() => setHistoricoVisivel((v) => !v)}
            className="mt-1 text-xs font-medium text-slate-400 underline decoration-dotted"
          >
            Histórico
          </button>
          {historicoVisivel && (
            <>
              <p className="mt-1 text-[11px] text-slate-400">
                {pedido.ultimaAlteracaoPor
                  ? `Última alteração por ${pedido.ultimaAlteracaoPor.username}${
                      pedido.ultimaAlteracaoEm ? ` em ${dataHoraBR(pedido.ultimaAlteracaoEm)}` : ''
                    }`
                  : 'Sem alterações após o envio.'}
              </p>
              <AlteracoesComercial revisoes={pedido.alteracoesComercial} />
            </>
          )}
        </div>

        {!podeEditar && (
          <p className="mb-4 text-center text-xs text-slate-400">
            Pedido {pedido.status === 'CANCELADO' ? 'cancelado' : 'em rascunho'} — não pode ser
            editado.
          </p>
        )}

        {podeEditar && !temMudancas && (
          precisaRevisao ? (
            <button
              onClick={aprovar}
              disabled={enviando}
              className="mb-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
            >
              {enviando ? 'Aprovando…' : 'Aprovar pedido'}
            </button>
          ) : (
            <Aviso tom="dica" compacto className="mb-4">
              {comAlteracoes ? 'Aprovado com alterações' : 'Aprovado'}
              {pedido.editadoPor ? ` por ${pedido.editadoPor.username}` : ''}
              {pedido.editadoEm ? ` em ${dataHoraBR(pedido.editadoEm)}` : ''}. Se mudar algo
              agora, será preciso confirmar de novo.
            </Aviso>
          )
        )}

        {podeEditar && (
          <p className="mb-2 text-xs text-slate-500">
            Mude quantidades e preços à vontade: nada é gravado até você confirmar. Quantidade
            vazia ou 0 tira o item.
          </p>
        )}

        <ul className="space-y-2">
          {pedido.itens.map((it) => {
            const b = base[it.id];
            const a = atual[it.id];
            const removido = a.quantidade <= 0;
            const mudou = mudados.has(it.id);
            const borda = removido
              ? 'border-l-4 border-red-400'
              : mudou
                ? 'border-l-4 border-brandYellow-400'
                : '';
            return (
              <li key={it.id} className={`rounded-xl bg-white p-4 shadow-sm ${borda}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`font-semibold ${removido ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                    >
                      {it.produto.nome}
                    </p>
                    {podeEditar && !removido ? (
                      <PrecoItem
                        precoCatalogo={b.precoUnitario}
                        precoAtual={a.precoUnitario}
                        unidade={it.produto.unidadeMedida}
                        desabilitado={enviando}
                        onChange={(v) => alterar(it.id, 'precoUnitario', v)}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        {brl(a.precoUnitario)} / {it.produto.unidadeMedida}
                      </p>
                    )}
                    {mudou && !removido && b.precoUnitario !== a.precoUnitario && (
                      <p className="text-[11px] text-slate-400">antes: {brl(b.precoUnitario)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {removido ? (
                      <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        removido
                      </span>
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">
                        {brl(subtotal(a.quantidade, a.precoUnitario))}
                      </p>
                    )}
                    {mudou && !removido && (
                      <span className="mt-1 inline-block rounded-md bg-brandYellow-50 px-1.5 py-0.5 text-xs font-medium text-brandYellow-800">
                        alterado
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {podeEditar ? (
                    <CampoQuantidade
                      valor={a.quantidade}
                      unidade={it.produto.unidadeMedida}
                      desabilitado={enviando}
                      onChange={(v) => alterar(it.id, 'quantidade', v)}
                    />
                  ) : (
                    <p className="text-sm text-slate-600">
                      {qtd(a.quantidade)} {it.produto.unidadeMedida}
                    </p>
                  )}
                  {mudou && (
                    <div className="text-right text-[11px] text-slate-400">
                      {b.quantidade !== a.quantidade && (
                        <p>
                          antes: {qtd(b.quantidade)} {it.produto.unidadeMedida}
                        </p>
                      )}
                      <button
                        onClick={() => voltarItem(it.id)}
                        disabled={enviando}
                        className="font-medium text-slate-500 underline decoration-dotted"
                      >
                        {removido ? 'desfazer remoção' : 'voltar ao original'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
          <p className="font-bold text-slate-700">Total</p>
          <p className="text-right">
            {temMudancas && totalAtual !== pedido.total && (
              <span className="mr-2 text-sm text-slate-400 line-through">{brl(pedido.total)}</span>
            )}
            <span className="text-lg font-bold text-brand-700">{brl(totalAtual)}</span>
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <a
            href={pedidosApi.pdfHref(pedido.id)}
            target="_blank"
            rel="noopener"
            className="flex-1 rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-500"
          >
            Baixar PDF
          </a>
          <a
            href={pedidosApi.txtHref(pedido.id)}
            className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Baixar TXT
          </a>
        </div>
        {temMudancas && (
          <p className="mt-2 text-center text-[11px] text-slate-400">
            O PDF e o TXT mostram o pedido como está gravado (sem as alterações não confirmadas).
          </p>
        )}
      </div>

      {/* ---- Painel fixo da revisão ---- */}
      {mostraPainel && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="mx-auto max-w-md space-y-2">
            <div
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                temMudancas ? 'bg-brandYellow-50 text-brandYellow-800' : 'bg-slate-50 text-slate-600'
              }`}
            >
              <button
                onClick={() => setPosicao((p) => p - 1)}
                disabled={!podeDesfazer || enviando}
                className="rounded-md border border-current px-2 py-1 text-xs font-medium disabled:opacity-30"
                aria-label="Desfazer a última alteração"
              >
                ↶ Desfazer
              </button>
              <span className="text-center text-xs font-medium">
                {temMudancas
                  ? `${mudados.size === 1 ? '1 item alterado' : `${mudados.size} itens alterados`}, não confirmado`
                  : 'Nenhuma alteração pendente'}
              </span>
              <button
                onClick={() => setPosicao((p) => p + 1)}
                disabled={!podeRefazer || enviando}
                className="rounded-md border border-current px-2 py-1 text-xs font-medium disabled:opacity-30"
                aria-label="Refazer a alteração desfeita"
              >
                Refazer ↷
              </button>
            </div>
            {temMudancas && (
              <>
                {semItens && (
                  <p className="text-center text-xs text-red-600">
                    O pedido precisa ter ao menos 1 item.
                  </p>
                )}
                <button
                  onClick={confirmarComAlteracoes}
                  disabled={enviando || semItens}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
                >
                  {enviando ? 'Confirmando…' : 'Confirmar pedido com alterações'}
                </button>
                <button
                  onClick={descartarTudo}
                  disabled={enviando}
                  className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Descartar alterações (voltar como o vendedor deixou)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
