import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useDialogo } from '../../context/DialogoContext';
import * as pedidosApi from '../../lib/pedidosApi';
import type { PedidoAdmin } from '../../lib/pedidosApi';
import { estiloStatus } from '../../lib/statusPedido';
import { brl, clienteBateBusca, dataBR, dataHoraBR, nomeCliente, razaoSecundaria } from '../../lib/formatar';

type AbaPedidos = 'EM_ANALISE' | 'APROVADOS' | 'TODOS' | 'EXCLUIDOS';

const ABAS: { chave: AbaPedidos; label: string }[] = [
  { chave: 'EM_ANALISE', label: 'Em análise' },
  { chave: 'APROVADOS', label: 'Aprovados' },
  { chave: 'TODOS', label: 'Todos' },
  { chave: 'EXCLUIDOS', label: 'Excluídos' },
];

export function AdminPedidosPage() {
  const dialogo = useDialogo();
  const [aba, setAba] = useState<AbaPedidos>('EM_ANALISE');
  const [busca, setBusca] = useState('');
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [compartilhando, setCompartilhando] = useState<{ id: string; tipo: 'pdf' | 'excel' } | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<Set<string>>(new Set());

  async function compartilharArquivo(p: PedidoAdmin, tipo: 'pdf' | 'excel') {
    setCompartilhando({ id: p.pedidoId, tipo });
    try {
      const fn = tipo === 'pdf' ? pedidosApi.compartilharPdfPedido : pedidosApi.compartilharExcelPedido;
      await fn({
        pedidoId: p.pedidoId,
        numeroPedido: p.numeroPedido,
        cliente: p.cliente,
      });
    } catch {
      await dialogo.avisar({
        titulo: `Não foi possível compartilhar o ${tipo === 'pdf' ? 'PDF' : 'Excel'}`,
        tom: 'erro',
        mensagem: 'Verifique o sinal e tente novamente.',
      });
    } finally {
      setCompartilhando(null);
    }
  }

  function toggleHistorico(pedidoId: string) {
    setHistoricoAberto((s) => {
      const n = new Set(s);
      if (n.has(pedidoId)) n.delete(pedidoId);
      else n.add(pedidoId);
      return n;
    });
  }

  useEffect(() => {
    setCarregando(true);
    pedidosApi
      .adminListarPedidos('tudo')
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(
    () =>
      pedidos.filter((p) =>
        clienteBateBusca(p.cliente, busca, [p.numeroPedido, p.vendedor.nomeCompleto]),
      ),
    [pedidos, busca],
  );

  const porAba = useMemo<Record<AbaPedidos, PedidoAdmin[]>>(() => {
    const emAnalise: PedidoAdmin[] = [];
    const aprovados: PedidoAdmin[] = [];
    const excluidos: PedidoAdmin[] = [];
    for (const p of filtrados) {
      if (p.status === 'CANCELADO') {
        excluidos.push(p);
      } else if (p.status === 'CONFIRMADO' && p.revisao === 'REVISADO') {
        aprovados.push(p);
      } else {
        emAnalise.push(p);
      }
    }
    return {
      EM_ANALISE: emAnalise,
      APROVADOS: aprovados,
      TODOS: filtrados,
      EXCLUIDOS: excluidos,
    };
  }, [filtrados]);

  const visiveis = porAba[aba];

  return (
    <AppLayout titulo="Pedidos" voltarPara="/">
      <input
        type="search"
        placeholder="Buscar por código do cliente, nome fantasia, razão social ou nº do pedido…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-brand-500"
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            onClick={() => setAba(a.chave)}
            className={`rounded-lg py-2 text-sm font-medium sm:flex-1 ${
              aba === a.chave
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {a.label} ({porAba[a.chave].length})
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="text-center text-slate-500">
          Nenhum pedido nesta aba.
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((p) => {
            const est = estiloStatus(p.status, p.revisao, p.comAlteracoes);
            return (
            <li
              key={p.pedidoId}
              className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${est.borderClass}`}
            >
              <Link
                to={`/admin/pedidos/${p.pedidoId}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-slate-800 hover:underline">
                    <span>{nomeCliente(p.cliente)}</span>
                    <span className="text-xs font-normal text-slate-500">Cód. {p.cliente.codigo}</span>
                    {est.badge && (
                      <span className="rounded-md bg-brandYellow-50 px-1.5 py-0.5 text-[10px] font-bold text-brandYellow-800 ring-1 ring-inset ring-brandYellow-300">
                        {est.badge}
                      </span>
                    )}
                    {p.status === 'CONFIRMADO' &&
                      p.comAlteracoes &&
                      p.vistoPeloVendedor !== null &&
                      p.vistoPeloVendedor !== undefined && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            p.vistoPeloVendedor
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-brandYellow-50 text-brandYellow-800'
                          }`}
                        >
                          {p.vistoPeloVendedor ? '✓ Visto pelo vendedor' : '● Não visto'}
                        </span>
                      )}
                  </p>
                  {razaoSecundaria(p.cliente) && (
                    <p className="text-xs text-slate-500">{razaoSecundaria(p.cliente)}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {p.numeroPedido ?? '—'} · {dataBR(p.data)} ·{' '}
                    {p.vendedor.nomeCompleto}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                  <span className={`text-xs font-medium ${est.textClass}`}>
                    {est.label}
                  </span>
                </div>
              </Link>

              <div className="mt-2">
                <button
                  onClick={() => toggleHistorico(p.pedidoId)}
                  className="text-xs font-medium text-slate-400 underline decoration-dotted"
                >
                  Histórico
                </button>
                {historicoAberto.has(p.pedidoId) && (
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

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => compartilharArquivo(p, 'pdf')}
                  disabled={compartilhando !== null}
                  className="rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
                >
                  {compartilhando?.id === p.pedidoId && compartilhando.tipo === 'pdf'
                    ? 'Abrindo…'
                    : 'Compartilhar PDF'}
                </button>
                <a
                  href={pedidosApi.pdfHref(p.pedidoId)}
                  target="_blank"
                  rel="noopener"
                  className="rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200 sm:flex-1"
                >
                  Baixar PDF
                </a>
                <button
                  type="button"
                  onClick={() => compartilharArquivo(p, 'excel')}
                  disabled={compartilhando !== null}
                  className="rounded-lg border border-brand-600 bg-white py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:flex-1"
                >
                  {compartilhando?.id === p.pedidoId && compartilhando.tipo === 'excel'
                    ? 'Abrindo…'
                    : 'Compartilhar Excel'}
                </button>
                <a
                  href={pedidosApi.excelHref(p.pedidoId)}
                  className="rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200 sm:flex-1"
                >
                  Baixar Excel
                </a>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </AppLayout>
  );
}
