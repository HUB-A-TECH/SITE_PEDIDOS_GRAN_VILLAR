import { useAuth } from '../context/AuthContext';

const TIPO_LABEL: Record<string, string> = {
  VENDEDOR: 'Vendedor',
  ADMIN_COMERCIAL: 'Admin Comercial',
  ADMIN_TI: 'Admin TI',
};

export function DashboardPage() {
  const { usuario, logout } = useAuth();

  const menu = [
    { titulo: 'Novo Pedido', desc: 'Iniciar um pedido para um cliente' },
    { titulo: 'Meus Pedidos', desc: 'Histórico de pedidos enviados' },
    { titulo: 'Selecionar Cliente', desc: 'Clientes do seu local' },
    { titulo: 'Minha Conta', desc: 'Dados e configurações' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Gran Villar</p>
          <p className="text-xs text-slate-300">
            {usuario?.username} · {usuario ? TIPO_LABEL[usuario.type] : ''}
          </p>
        </div>
        <button
          onClick={() => logout()}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-md p-4">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Menu</h2>
        <div className="grid grid-cols-1 gap-3">
          {menu.map((item) => (
            <button
              key={item.titulo}
              className="rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <p className="font-semibold text-slate-800">{item.titulo}</p>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Fase 1 concluída — as telas do menu chegam nas próximas fases.
        </p>
      </main>
    </div>
  );
}
