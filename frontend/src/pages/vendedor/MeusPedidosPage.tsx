import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import * as historicoApi from '../../lib/historicoApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { MeuPedido } from '../../lib/historicoApi';
import { LIMITE_OPCOES, type Limite } from '../../lib/types';
import {
  estiloStatus,
  grupoDoPedido,
  GRUPOS,
  type Grupo,
} from '../../lib/statusPedido';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Vendedor pode cancelar sozinho até 1 dia após confirmar (RN-08). */
function dentroDaJanela(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() <= UM_DIA_MS;
}

export function MeusPedidosPage() {
  const [limite, setLimite] = useState<Limite>(12);
  const [pedidos, setPedidos] = useState<MeuPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<Set<string>>(new Set());
  const [recolhidos, setRecolhidos] = useState<Set<Grupo>>(
    () => new Set(GRUPOS.filter((g) => g.recolhidoPorPadrao).map((g) => g.chave)),
  );

  /** Pedidos separados por seção, na ordem definida em GRUPOS. */
  const porGrupo = useMemo(() => {
    const mapa = new Map<Grupo, MeuPedido[]>(GRUPOS.map((g) => [g.chave, []]));
    for (const p of pedidos) {
      mapa.get(grupoDoPedido(p.status, p.revisao))!.push(p);
    }
    return mapa;
  }, [pedidos]);

  const totalAConfirmar = porGrupo.get('A_CONFIRMAR')?.length ?? 0;

  const carregar = useCallback(() => {
    setCarregando(true);
    historicoApi
      .meuHistorico(limite)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [limite]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggleHistorico(pedidoId: string) {
    setHistoricoAberto((s) => {
      const n = new Set(s);
      if (n.has(pedidoId)) n.delete(pedidoId);
      else n.add(pedidoId);
      return n;
    });
  }

  /** Envia o pedido para a administração. Antes disso, só o vendedor o vê. */
  async function confirmarEnvio(p: MeuPedido) {
    if (
      !confirm(
        `Enviar o pedido de ${p.cliente.nome} para a administração?

` +
          `${p.itensCount} itens · ${brl(p.total)}`,
      )
    ) {
      return;
    }
    setProcessando(p.pedidoId);
    try {
      const { numeroPedido } = await pedidosApi.confirmar(p.pedidoId);
      alert(`Pedido ${numeroPedido} enviado à administração.`);
      carregar();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.mensagem) {
        alert(e.response.data.mensagem);
      } else {
        alert('Não foi possível enviar o pedido.');
      }
    } finally {
      setProcessando(null);
    }
  }

  function alternarGrupo(chave: Grupo) {
    setRecolhidos((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  }

  async function cancelar(p: MeuPedido) {
    if (!confirm(`Cancelar o pedido ${p.numeroPedido}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    const motivo = prompt('Motivo do cancelamento (opcional):') ?? undefined;
    setProcessando(p.pedidoId);
    try {
      await pedidosApi.cancelar(p.pedidoId, motivo);
      carregar();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.mensagem) {
        alert(e.response.data.mensagem);
      } else {
        alert('Não foi possível cancelar.');
      }
    } finally {
      setProcessando(null);
    }
  }

  /** Card de um pedido — mesmo formato em todas as seções. */
  function renderCard(p: MeuPedido) {
          const podeCancelar =
            p.status === 'CONFIRMADO' && dentroDaJanela(p.data);
          const mostraHistorico = p.status !== 'RASCUNHO';
          const historicoVisivel = historicoAberto.has(p.pedidoId);
          const est = estiloStatus(p.status, p.revisao);
          return (
            <li
              key={p.pedidoId}
              className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${est.borderClass}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{p.cliente.nome}</p>
                  <p className="text-xs text-slate-500">
                    {p.numeroPedido ?? '—'} · {dataBR(p.data)} ·{' '}
                    {p.itensCount === 1 ? '1 item' : `${p.itensCount} itens`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                  <span className={`text-xs font-medium ${est.textClass}`}>
                    {est.label}
                  </span>
                </div>
              </div>

              {mostraHistorico && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleHistorico(p.pedidoId)}
                    className="text-xs font-medium text-slate-400 underline decoration-dotted"
                  >
                    Histórico
                  </button>
                  {historicoVisivel && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {p.ultimaAlteracaoPor
                        ? `Última alteração por ${p.ultimaAlteracaoPor.username}${
                            p.ultimaAlteracaoEm
                              ? ` em ${dataHoraBR(p.ultimaAlteracaoEm)}`
                              : ''
                          }`
                        : 'Sem alterações após o envio.'}
                    </p>
                  )}
                </div>
              )}

              {p.status === 'RASCUNHO' ? (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => confirmarEnvio(p)}
                    disabled={processando === p.pedidoId || p.itensCount === 0}
                    className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {processando === p.pedidoId
                      ? 'Enviando…'
                      : 'Confirmar e enviar'}
                  </button>
                  <Link
                    to={`/pedido/${p.pedidoId}`}
                    className="block rounded-lg border border-brand-600 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Continuar editando
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={pedidosApi.pdfHref(p.pedidoId)}
                      target="_blank"
                      rel="noopener"
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-500"
                    >
                      Baixar PDF
                    </a>
                    <a
                      href={pedidosApi.txtHref(p.pedidoId)}
                      className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Baixar TXT
                    </a>
                  </div>
                  {p.status === 'CONFIRMADO' && (
                    <Link
                      to={`/pedido/${p.pedidoId}`}
                      className="mt-2 block rounded-lg border border-brand-600 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Editar pedido
                    </Link>
                  )}
                </>
              )}
              {podeCancelar && (
                <button
                  onClick={() => cancelar(p)}
                  disabled={processando === p.pedidoId}
                  className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {processando === p.pedidoId ? 'Cancelando…' : 'Cancelar'}
                </button>
              )}
            </li>
          );
  }

  return (
    <AppLayout titulo="Meus Pedidos" voltarPara="/">
      <div className="mb-4 flex gap-2">
        {LIMITE_OPCOES.map((o) => (
          <button
            key={o.valor}
            onClick={() => setLimite(o.valor)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              limite === o.valor
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {totalAConfirmar > 0 && (
        <Aviso
          tom="atencao"
          className="mb-4"
          titulo={
            totalAConfirmar === 1
              ? '1 pedido aguardando sua confirmação'
              : `${totalAConfirmar} pedidos aguardando sua confirmação`
          }
        >
          Enquanto não confirmar, a administração não recebe.
        </Aviso>
      )}

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum pedido neste período.</p>
      ) : (
        <div className="space-y-5">
          {GRUPOS.map((g) => {
            const lista = porGrupo.get(g.chave) ?? [];
            if (lista.length === 0) return null;
            const recolhido = recolhidos.has(g.chave);
            return (
              <section key={g.chave}>
                <button
                  onClick={() => alternarGrupo(g.chave)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.pontoClass}`} />
                  <span className="font-semibold text-slate-800">{g.titulo}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {lista.length}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    {recolhido ? 'mostrar' : 'ocultar'}
                  </span>
                </button>
                {!recolhido && (
                  <>
                    <p className="mb-2 text-xs text-slate-500">{g.descricao}</p>
                    <ul className="space-y-2">
                      {lista.map((p) => renderCard(p))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
