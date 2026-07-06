import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import * as clientesApi from '../../lib/clientesApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Pedido } from '../../lib/pedidosApi';
import type { Cliente } from '../../lib/types';

export function SelecionarClientePage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [conflito, setConflito] = useState<{
    rascunho: Pedido;
    clienteAlvo: Cliente;
  } | null>(null);

  useEffect(() => {
    clientesApi
      .listar()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

  async function iniciarPedido(cliente: Cliente) {
    setIniciando(cliente.id);
    try {
      const r = await pedidosApi.criar(cliente.id);
      if (r.tipo === 'criado') {
        navigate('/pedido');
      } else {
        setConflito({ rascunho: r.rascunho, clienteAlvo: cliente });
      }
    } finally {
      setIniciando(null);
    }
  }

  async function descartarEIniciar() {
    if (!conflito) return;
    await pedidosApi.descartar(conflito.rascunho.id);
    const alvo = conflito.clienteAlvo;
    setConflito(null);
    await iniciarPedido(alvo);
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

      <Modal
        titulo="Rascunho em andamento"
        aberto={conflito !== null}
        onFechar={() => setConflito(null)}
      >
        {conflito && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Você já tem um rascunho para{' '}
              <strong>{conflito.rascunho.cliente.nome}</strong> (
              {conflito.rascunho.itens.length} item(ns)). Só é possível ter um
              rascunho por vez.
            </p>
            <button
              onClick={() => {
                setConflito(null);
                navigate('/pedido');
              }}
              className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900"
            >
              Continuar rascunho de {conflito.rascunho.cliente.nome}
            </button>
            <button
              onClick={descartarEIniciar}
              className="w-full rounded-lg border border-red-200 py-2.5 font-medium text-red-600 hover:bg-red-50"
            >
              Descartar e iniciar para {conflito.clienteAlvo.nome}
            </button>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
