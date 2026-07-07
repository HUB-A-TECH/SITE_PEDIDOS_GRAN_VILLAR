import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import * as historicoApi from '../../lib/historicoApi';
import type { MeuPedido, Periodo } from '../../lib/historicoApi';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const PERIODOS: Periodo[] = [3, 6, 12];

export function MeusPedidosPage() {
  const [periodo, setPeriodo] = useState<Periodo>(6);
  const [pedidos, setPedidos] = useState<MeuPedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    historicoApi
      .meuHistorico(periodo)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [periodo]);

  return (
    <AppLayout titulo="Meus Pedidos" voltarPara="/">
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
          Nenhum pedido confirmado neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li
              key={p.pedidoId}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">{p.cliente.nome}</p>
                <p className="text-xs text-slate-500">
                  {p.numeroPedido ?? '—'} · {dataBR(p.data)} · {p.itensCount} itens
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
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
