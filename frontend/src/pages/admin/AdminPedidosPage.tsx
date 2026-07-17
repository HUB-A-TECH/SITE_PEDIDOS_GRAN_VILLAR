import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as pedidosApi from '../../lib/pedidosApi';
import type { PedidoAdmin } from '../../lib/pedidosApi';
import * as clientesApi from '../../lib/clientesApi';
import { LIMITE_OPCOES, type Limite } from '../../lib/types';
import type { Cliente } from '../../lib/types';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function AdminPedidosPage() {
  const [limite, setLimite] = useState<Limite>(12);
  const [clienteId, setClienteId] = useState<string>('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    clientesApi.listar().then(setClientes).catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    setCarregando(true);
    pedidosApi
      .adminListarPedidos(limite, clienteId || undefined)
      .then(setPedidos)
      .finally(() => setCarregando(false));
  }, [limite, clienteId]);

  return (
    <AppLayout titulo="Pedidos" voltarPara="/">
      <select
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-brand-500"
      >
        <option value="">Todas as empresas</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

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
          Nenhum pedido encontrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.pedidoId} className="rounded-xl bg-white p-4 shadow-sm">
              <Link
                to={`/admin/pedidos/${p.pedidoId}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800 hover:underline">
                    {p.cliente.nome}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.numeroPedido ?? '—'} · {dataBR(p.data)} ·{' '}
                    {p.vendedor.nomeCompleto}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{brl(p.total)}</p>
                  <span
                    className={`text-xs font-medium ${
                      p.status === 'CANCELADO' ? 'text-red-500' : 'text-brand-600'
                    }`}
                  >
                    {p.status === 'CANCELADO' ? 'Cancelado' : 'Confirmado'}
                  </span>
                </div>
              </Link>
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
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
