import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import * as historicoApi from '../lib/historicoApi';
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
  /** Contagem em destaque (ex.: pedidos esperando confirmação). */
  aviso?: number;
}

export function DashboardPage() {
  const { usuario } = useAuth();
  // Pedidos salvos que ainda não foram enviados. Mostrado aqui para o vendedor
  // não esquecer de confirmar — antes disso, a administração não os vê.
  const [aConfirmar, setAConfirmar] = useState(0);
  const ehVendedor = usuario?.type === 'VENDEDOR';

  useEffect(() => {
    if (!ehVendedor) return;
    historicoApi
      .meuHistorico('tudo')
      .then((ps) => setAConfirmar(ps.filter((p) => p.status === 'RASCUNHO').length))
      .catch(() => setAConfirmar(0));
  }, [ehVendedor]);

  if (!usuario) return null;

  const isAdmin = usuario.type !== 'VENDEDOR';
  const isAdminTI = usuario.type === 'ADMIN_TI';

  const itens: ItemMenu[] = isAdmin
    ? [
        { titulo: 'Produtos', desc: 'Catálogo: adicionar e editar', to: '/admin/produtos' },
        { titulo: 'Tabelas de Preço', desc: 'Preços por grupo de clientes', to: '/admin/tabelas' },
        { titulo: 'Clientes', desc: 'Cadastro e mix de cada cliente', to: '/admin/clientes' },
        {
          titulo: 'Setores',
          desc: 'Regiões de visita: vendedores e clientes de cada uma',
          to: '/admin/setores',
        },
        { titulo: 'Pedidos', desc: 'Ver pedidos e baixar TXT', to: '/admin/pedidos' },
        ...(isAdminTI
          ? [
              {
                titulo: 'Dados da Empresa',
                desc: 'Telefone e endereço que saem no PDF',
                to: '/admin/empresa',
              },
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
        {
          titulo: 'Meus Clientes',
          desc: 'Perfil, contato e compras de cada cliente',
          to: '/meus-clientes',
        },
        {
          titulo: 'Meus Pedidos',
          desc:
            aConfirmar > 0
              ? 'Confirme os pedidos salvos para enviar à administração'
              : 'Pedidos salvos, enviados e cancelados',
          to: '/meus-pedidos',
          aviso: aConfirmar,
        },
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
              <p className="flex items-center gap-2 font-semibold text-slate-800">
                {item.titulo}
                {item.aviso ? (
                  <span className="rounded-full bg-brandYellow-400 px-2 py-0.5 text-xs font-bold text-brandYellow-900">
                    {item.aviso} a confirmar
                  </span>
                ) : null}
              </p>
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
