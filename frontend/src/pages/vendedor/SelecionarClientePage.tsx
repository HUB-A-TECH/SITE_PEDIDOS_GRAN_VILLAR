import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as clientesApi from '../../lib/clientesApi';
import type { Cliente } from '../../lib/types';

export function SelecionarClientePage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    clientesApi
      .listar()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

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
                onClick={() => navigate(`/clientes/${c.id}/produtos`)}
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm hover:shadow-md"
              >
                <p className="font-semibold text-slate-800">{c.nome}</p>
                <p className="text-sm text-slate-500">
                  {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
                  {c.codigo}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
