import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import * as historicoApi from '../../lib/historicoApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { MeuPedido } from '../../lib/historicoApi';
import { LIMITE_OPCOES, type Limite } from '../../lib/types';

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

const STATUS_LABEL: Record<MeuPedido['status'], string> = {
  RASCUNHO: 'Salvo (não enviado)',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
};

const STATUS_COR: Record<MeuPedido['status'], string> = {
  RASCUNHO: 'text-amber-600',
  CONFIRMADO: 'text-brand-600',
  CANCELADO: 'text-red-500',
};

export function MeusPedidosPage() {
  const [limite, setLimite] = useState<Limite>(12);
  const [pedidos, setPedidos] = useState<MeuPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<Set<string>>(new Set());

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

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum pedido neste período.</p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => {
            const podeCancelar =
              p.status === 'CONFIRMADO' && dentroDaJanela(p.data);
            const mostraHistorico = p.status !== 'RASCUNHO';
            const historicoVisivel = historicoAberto.has(p.pedidoId);
            return (
              <li key={p.pedidoId} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{p.cliente.nome}</p>
                    <p className="text-xs text-slate-500">
                      {p.numeroPedido ?? '—'} · {dataBR(p.data)} · {p.itensCount} itens
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                    <span className={`text-xs font-medium ${STATUS_COR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
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
                        {p.editadoPor
                          ? `Última alteração por ${p.editadoPor.username}${
                              p.editadoEm ? ` em ${dataHoraBR(p.editadoEm)}` : ''
                            }`
                          : 'Ainda não revisado pela administração.'}
                      </p>
                    )}
                  </div>
                )}

                {p.status === 'RASCUNHO' ? (
                  <Link
                    to={`/pedido/${p.pedidoId}`}
                    className="mt-3 block rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-500"
                  >
                    Continuar editando
                  </Link>
                ) : (
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
          })}
        </ul>
      )}
    </AppLayout>
  );
}
