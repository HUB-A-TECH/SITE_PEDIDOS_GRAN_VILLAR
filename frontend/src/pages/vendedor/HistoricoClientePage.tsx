import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as historicoApi from '../../lib/historicoApi';
import type { PedidoHistorico } from '../../lib/historicoApi';
import { LIMITE_OPCOES, type Limite } from '../../lib/types';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function HistoricoClientePage() {
  const { clienteId = '' } = useParams();
  const [limite, setLimite] = useState<Limite>(12);
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    historicoApi
      .historicoCliente(clienteId, limite)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [clienteId, limite]);

  return (
    <AppLayout titulo="Histórico do Cliente" voltarPara="/pedido">
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
