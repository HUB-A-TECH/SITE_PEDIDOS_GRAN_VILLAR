import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import type { UserType } from '../lib/types';

const TIPO_LABEL: Record<UserType, string> = {
  VENDEDOR: 'Vendedor',
  ADMIN_COMERCIAL: 'Admin Comercial',
  ADMIN_TI: 'Admin TI',
};

interface ItemMenu {
  titulo: string;
  desc: string;
  to?: string;
}

export function DashboardPage() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const isAdmin = usuario.type !== 'VENDEDOR';
  const isAdminTI = usuario.type === 'ADMIN_TI';

  const itens: ItemMenu[] = isAdmin
    ? [
        { titulo: 'Produtos', desc: 'Catálogo: adicionar e editar', to: '/admin/produtos' },
        { titulo: 'Clientes', desc: 'Cadastro e mix de cada cliente', to: '/admin/clientes' },
        { titulo: 'Pedidos', desc: 'Ver pedidos e baixar TXT', to: '/admin/pedidos' },
        ...(isAdminTI
          ? [
              {
                titulo: 'Usuários',
                desc: 'Cadastrar administradores e vendedores',
                to: '/admin/usuarios',
              },
            ]
          : []),
      ]
    : [
        { titulo: 'Novo Pedido', desc: 'Começa selecionando o cliente', to: '/clientes' },
        { titulo: 'Continuar Pedido', desc: 'Editar o pedido em aberto', to: '/pedido' },
        { titulo: 'Meus Pedidos', desc: 'Histórico de pedidos enviados', to: '/meus-pedidos' },
        { titulo: 'Minha Conta', desc: 'Dados e configurações (em breve)' },
      ];

  return (
    <AppLayout titulo={`Gran Villar · ${TIPO_LABEL[usuario.type]}`}>
      <h2 className="mb-4 text-lg font-bold text-slate-800">Menu</h2>
      <div className="grid grid-cols-1 gap-3">
        {itens.map((item) =>
          item.to ? (
            <Link
              key={item.titulo}
              to={item.to}
              className="rounded-xl border-l-4 border-brand-500 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="font-semibold text-slate-800">{item.titulo}</p>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </Link>
          ) : (
            <div
              key={item.titulo}
              className="cursor-not-allowed rounded-xl bg-white/60 p-4 shadow-sm"
            >
              <p className="font-semibold text-slate-400">{item.titulo}</p>
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          ),
        )}
      </div>
    </AppLayout>
  );
}
