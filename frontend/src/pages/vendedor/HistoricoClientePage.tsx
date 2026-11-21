import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { AlteracoesComercial } from '../../components/AlteracoesComercial';
import { useAuth } from '../../context/AuthContext';
import * as historicoApi from '../../lib/historicoApi';
import type { PedidoHistorico } from '../../lib/historicoApi';
import { LIMITE_OPCOES, type Limite } from '../../lib/types';
import { brl, dataBR } from '../../lib/formatar';


export function HistoricoClientePage() {
  const { clienteId = '' } = useParams();
  const { usuario } = useAuth();
  const isAdmin = usuario?.type !== 'VENDEDOR';
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

  const totalPeriodo = useMemo(
    () => pedidos.reduce((soma, p) => soma + p.total, 0),
    [pedidos],
  );

  return (
    <AppLayout
      titulo="Histórico do Cliente"
      voltarPara={`/clientes/${clienteId}`}
      voltarUsaHistorico
    >
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
        <>
          <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            <span className="text-slate-600">
              {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </span>
            <span className="font-bold text-brand-700">{brl(totalPeriodo)}</span>
          </div>
          <ul className="space-y-3">
            {pedidos.map((p) => (
              <li key={p.pedidoId} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-slate-800">
                      <span>{p.numeroPedido ?? 'Pedido'}</span>
                      {p.situacao && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                            p.situacao === 'APROVADO'
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-brandYellow-50 text-brandYellow-800'
                          }`}
                        >
                          {p.situacao === 'APROVADO' ? 'Aprovado' : 'Em análise'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{dataBR(p.data)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                    {isAdmin && (
                      <Link
                        to={`/admin/pedidos/${p.pedidoId}`}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Abrir pedido →
                      </Link>
                    )}
                  </div>
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
                <AlteracoesComercial revisoes={p.alteracoesComercial ?? []} compacto />
              </li>
            ))}
          </ul>
        </>
      )}
    </AppLayout>
  );
}
