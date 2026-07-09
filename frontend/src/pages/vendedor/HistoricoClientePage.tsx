import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as historicoApi from '../../lib/historicoApi';
import type { PedidoHistorico, Periodo } from '../../lib/historicoApi';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const PERIODOS: Periodo[] = [3, 6, 12];

export function HistoricoClientePage() {
  const { clienteId = '' } = useParams();
  const [periodo, setPeriodo] = useState<Periodo>(6);
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    historicoApi
      .historicoCliente(clienteId, periodo)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [clienteId, periodo]);

  return (
    <AppLayout titulo="Histórico do Cliente" voltarPara="/pedido">
      <div className="mb-4 flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              periodo === p
                ? 'bg-brand-600 text-white'
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
          Nenhuma compra confirmada neste período.
        </p>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.pedidoId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    {p.numeroPedido ?? 'Pedido'}
                  </p>
                  <p className="text-xs text-slate-500">{dataBR(p.data)}</p>
                </div>
                <p className="font-semibold text-slate-800">{brl(p.total)}</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {p.itens.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="py-1 text-slate-700">{it.nome}</td>
                      <td className="py-1 text-right text-slate-500">
                        {it.quantidade} {it.unidadeMedida}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
