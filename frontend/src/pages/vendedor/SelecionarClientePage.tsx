import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as clientesApi from '../../lib/clientesApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Cliente } from '../../lib/types';

export function SelecionarClientePage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [iniciando, setIniciando] = useState<string | null>(null);

  useEffect(() => {
    clientesApi
      .listar()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

  async function iniciarPedido(cliente: Cliente) {
    setIniciando(cliente.id);
    try {
      // Retoma o pedido salvo desse cliente, se houver, ou cria um novo.
      const pedido = await pedidosApi.criar(cliente.id);
      navigate(`/pedido/${pedido.id}`);
    } finally {
      setIniciando(null);
    }
  }

  const filtrados = clientes.filter((c) =>
    `${c.nome} ${c.nomeFantasia ?? ''} ${c.codigo}`
      .toLowerCase()
      .includes(busca.toLowerCase()),
  );

  return (
    <AppLayout titulo="Selecionar Cliente" voltarPara="/">
      <input
        type="search"
        placeholder="Buscar cliente…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum cliente encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => iniciarPedido(c)}
                disabled={iniciando !== null}
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm hover:shadow-md disabled:opacity-60"
              >
                <p className="font-semibold text-slate-800">{c.nome}</p>
                <p className="text-sm text-slate-500">
                  {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
                  {c.codigo}
                  {iniciando === c.id && ' · abrindo…'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
