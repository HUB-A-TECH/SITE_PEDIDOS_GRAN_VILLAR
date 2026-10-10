import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { ListaClientesPorSetor } from '../../components/ListaClientesPorSetor';
import * as clientesApi from '../../lib/clientesApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { Cliente } from '../../lib/types';

export function SelecionarClientePage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
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

  return (
    <AppLayout titulo="Selecionar Cliente" voltarPara="/">
      <ListaClientesPorSetor
        clientes={clientes}
        carregando={carregando}
        onEscolher={iniciarPedido}
        abrindoId={iniciando}
      />
    </AppLayout>
  );
}
