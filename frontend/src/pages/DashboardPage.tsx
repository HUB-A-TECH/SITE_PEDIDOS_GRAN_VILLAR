import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Aviso } from '../components/Aviso';
import { useAuth } from '../context/AuthContext';
import * as pedidosApi from '../lib/pedidosApi';
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
  const { usuario, trocarModo } = useAuth();
  const [trocando, setTrocando] = useState(false);
  const [erroTroca, setErroTroca] = useState('');
  // Pedidos salvos que ainda não foram enviados. Mostrado aqui para o vendedor
  // não esquecer de confirmar — antes disso, a administração não os vê.
  const [aConfirmar, setAConfirmar] = useState(0);
  // Pedidos que o comercial aprovou com alterações e o vendedor ainda não viu.
  const [alteracoes, setAlteracoes] = useState(0);
  const ehVendedor = usuario?.type === 'VENDEDOR';

  useEffect(() => {
    if (!ehVendedor) return;
    pedidosApi
      .resumoMenu()
      .then((r) => {
        setAConfirmar(r.aConfirmar);
        setAlteracoes(r.alteracoes);
      })
      .catch(() => {
        setAConfirmar(0);
        setAlteracoes(0);
      });
  }, [ehVendedor]);

  if (!usuario) return null;

  const isAdmin = usuario.type !== 'VENDEDOR';
  const isAdminTI = usuario.type === 'ADMIN_TI';

  const itens: ItemMenu[] = isAdmin
    ? [
        { titulo: 'Produtos', desc: 'Catálogo: adicionar e editar', to: '/admin/produtos' },
        { titulo: 'Categorias', desc: 'Nomes e ordem em que os produtos aparecem', to: '/admin/categorias' },
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
                desc: 'Cadastrar pessoas e escolher o perfil de cada uma',
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
      ];

  return (
    <AppLayout titulo={`Gran Villar · ${TIPO_LABEL[usuario.type]}`}>
      {usuario.modos && usuario.modos.length > 1 && (
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm">
          <p className="mb-2 text-sm font-medium text-slate-700">Estou trabalhando como</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo de trabalho">
            {usuario.modos.map((modo) => {
              const ativo = modo === usuario.type;
              return (
                <button
                  key={modo}
                  type="button"
                  aria-pressed={ativo}
                  disabled={trocando}
                  onClick={async () => {
                    if (ativo) return;
                    setErroTroca('');
                    setTrocando(true);
                    try {
                      await trocarModo(modo);
                    } catch {
                      setErroTroca('Não foi possível trocar agora. Tente de novo.');
                    } finally {
                      setTrocando(false);
                    }
                  }}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    ativo
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {modo === 'VENDEDOR' ? 'Vendedor' : 'Comercial'}
                </button>
              );
            })}
          </div>
          {erroTroca && (
            <Aviso tom="erro" compacto className="mt-2">
              {erroTroca}
            </Aviso>
          )}
        </div>
      )}
      {alteracoes > 0 && (
        <Link to="/meus-pedidos" className="mb-4 block">
          <Aviso
            tom="atencao"
            titulo={
              alteracoes === 1
                ? '1 pedido aprovado com alterações do comercial'
                : `${alteracoes} pedidos aprovados com alterações do comercial`
            }
          >
            Toque para ver o que foi mudado.
          </Aviso>
        </Link>
      )}
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
