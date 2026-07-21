import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { CampoQuantidade, PrecoItem } from '../../components/ItemEditors';
import * as pedidosApi from '../../lib/pedidosApi';
import type { PedidoAdminDetalhe } from '../../lib/pedidosApi';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function AdminPedidoDetalhePage() {
  const { id = '' } = useParams();
  const [pedido, setPedido] = useState<PedidoAdminDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const [historicoVisivel, setHistoricoVisivel] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [aprovado, setAprovado] = useState(false);

  useEffect(() => {
    setCarregando(true);
    pedidosApi.adminObterPedido(id).then(setPedido).finally(() => setCarregando(false));
  }, [id]);

  async function alterar(
    itemId: string,
    acao: (pedidoId: string, itemId: string) => Promise<PedidoAdminDetalhe>,
  ) {
    if (!pedido) return;
    setProcessando((s) => new Set(s).add(itemId));
    try {
      const atualizado = await acao(pedido.id, itemId);
      setPedido(atualizado);
    } catch (e) {
      alert(
        axios.isAxiosError(e) && e.response?.data?.mensagem
          ? e.response.data.mensagem
          : 'Não foi possível alterar.',
      );
    } finally {
      setProcessando((s) => {
        const n = new Set(s);
        n.delete(itemId);
        return n;
      });
    }
  }

  async function aprovar() {
    if (!pedido) return;
    setAprovando(true);
    try {
      const atualizado = await pedidosApi.adminAprovar(pedido.id);
      setPedido(atualizado);
      setAprovado(true);
      window.setTimeout(() => setAprovado(false), 2000);
    } catch (e) {
      alert(
        axios.isAxiosError(e) && e.response?.data?.mensagem
          ? e.response.data.mensagem
          : 'Não foi possível aprovar.',
      );
    } finally {
      setAprovando(false);
    }
  }

  if (carregando || !pedido) {
    return (
      <AppLayout titulo="Pedido" voltarPara="/admin/pedidos">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }

  const podeEditar = pedido.status === 'CONFIRMADO';

  return (
    <AppLayout
      titulo={pedido.numeroPedido ? `Pedido ${pedido.numeroPedido}` : 'Pedido'}
      voltarPara="/admin/pedidos"
    >
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p className="font-semibold text-slate-800">{pedido.cliente.nome}</p>
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
          <p className="mt-1 text-[11px] text-slate-400">
            {pedido.editadoPor
              ? `Última alteração por ${pedido.editadoPor.username}${
                  pedido.editadoEm ? ` em ${dataHoraBR(pedido.editadoEm)}` : ''
                }`
              : 'Ainda não revisado.'}
          </p>
        )}
      </div>

      {podeEditar && (
        <button
          onClick={aprovar}
          disabled={aprovando}
          className="mb-4 w-full rounded-lg border border-brand-600 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
        >
          {aprovado ? 'Aprovado ✓' : aprovando ? 'Aprovando…' : 'Aprovar (sem alterações)'}
        </button>
      )}

      {!podeEditar && (
        <p className="mb-4 text-center text-xs text-slate-400">
          Pedido {pedido.status === 'CANCELADO' ? 'cancelado' : 'em rascunho'} — não
          pode ser editado.
        </p>
      )}

      <ul className="space-y-2">
        {pedido.itens.map((it) => {
          const ocupado = processando.has(it.id);
          return (
            <li key={it.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{it.produto.nome}</p>
                  {podeEditar ? (
                    <PrecoItem
                      precoCatalogo={it.precoUnitario}
                      precoAtual={it.precoUnitario}
                      unidade={it.produto.unidadeMedida}
                      desabilitado={ocupado}
                      onChange={(v) =>
                        alterar(it.id, (pid, iid) => pedidosApi.adminAtualizarPreco(pid, iid, v))
                      }
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      {brl(it.precoUnitario)} / {it.produto.unidadeMedida}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-700">{brl(it.subtotal)}</p>
              </div>
              <div className="mt-3">
                {podeEditar ? (
                  <CampoQuantidade
                    valor={it.quantidade}
                    unidade={it.produto.unidadeMedida}
                    desabilitado={ocupado}
                    onChange={(v) =>
                      alterar(it.id, (pid, iid) => pedidosApi.adminAtualizarQuantidade(pid, iid, v))
                    }
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    {it.quantidade} {it.produto.unidadeMedida}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-700">Total</p>
        <p className="text-lg font-bold text-brand-700">{brl(pedido.total)}</p>
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
    </AppLayout>
  );
}
