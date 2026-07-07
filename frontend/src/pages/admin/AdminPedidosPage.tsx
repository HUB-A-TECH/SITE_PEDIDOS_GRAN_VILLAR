import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import * as pedidosApi from '../../lib/pedidosApi';
import type { PedidoAdmin } from '../../lib/pedidosApi';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const PERIODOS: (3 | 6 | 12)[] = [3, 6, 12];

export function AdminPedidosPage() {
  const [periodo, setPeriodo] = useState<3 | 6 | 12>(6);
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    pedidosApi
      .adminListarPedidos(periodo)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [periodo]);

  return (
    <AppLayout titulo="Pedidos" voltarPara="/">
      <div className="mb-4 flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              periodo === p
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p} meses
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p className="text-center text-slate-500">
          Nenhum pedido neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.pedidoId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{p.cliente.nome}</p>
                  <p className="text-xs text-slate-500">
                    {p.numeroPedido ?? '—'} · {dataBR(p.data)} ·{' '}
                    {p.vendedor.nomeCompleto}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                  <span
                    className={`text-xs font-medium ${
                      p.status === 'CANCELADO' ? 'text-red-500' : 'text-emerald-600'
                    }`}
                  >
                    {p.status === 'CANCELADO' ? 'Cancelado' : 'Confirmado'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={pedidosApi.pdfHref(p.pedidoId)}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500"
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
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
