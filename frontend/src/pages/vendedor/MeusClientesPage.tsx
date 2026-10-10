import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { ListaClientesPorSetor } from '../../components/ListaClientesPorSetor';
import * as clientesApi from '../../lib/clientesApi';
import type { Cliente } from '../../lib/types';

/** Clientes do vendedor, por setor; tocar abre o perfil (não inicia pedido). */
export function MeusClientesPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    clientesApi
      .listar()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

  return (
    <AppLayout titulo="Meus Clientes" voltarPara="/">
      <ListaClientesPorSetor
        clientes={clientes}
        carregando={carregando}
        onEscolher={(c) => navigate(`/clientes/${c.id}`)}
      />
    </AppLayout>
  );
}
