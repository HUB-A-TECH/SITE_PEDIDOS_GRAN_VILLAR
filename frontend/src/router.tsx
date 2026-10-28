import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MinhaContaPage } from './pages/MinhaContaPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { PaginaLazy } from './components/PaginaLazy';
import { SelecionarClientePage } from './pages/vendedor/SelecionarClientePage';
import { PedidoPage } from './pages/vendedor/PedidoPage';
import { HistoricoClientePage } from './pages/vendedor/HistoricoClientePage';
import { MeusPedidosPage } from './pages/vendedor/MeusPedidosPage';
import { MeusClientesPage } from './pages/vendedor/MeusClientesPage';
import { PerfilClientePage } from './pages/vendedor/PerfilClientePage';
import type { UserType } from './lib/types';

// Telas de administração: só baixam quando alguém abre (o vendedor nunca paga esse peso).
const AdminProdutosPage = lazy(() =>
  import('./pages/admin/AdminProdutosPage').then((m) => ({ default: m.AdminProdutosPage })),
);
const AdminClientesPage = lazy(() =>
  import('./pages/admin/AdminClientesPage').then((m) => ({ default: m.AdminClientesPage })),
);
const AdminClienteMixPage = lazy(() =>
  import('./pages/admin/AdminClienteMixPage').then((m) => ({ default: m.AdminClienteMixPage })),
);
const AdminTabelasPage = lazy(() =>
  import('./pages/admin/AdminTabelasPage').then((m) => ({ default: m.AdminTabelasPage })),
);
const AdminFiliaisPage = lazy(() =>
  import('./pages/admin/AdminFiliaisPage').then((m) => ({ default: m.AdminFiliaisPage })),
);
const AdminTabelaDetalhePage = lazy(() =>
  import('./pages/admin/AdminTabelaDetalhePage').then((m) => ({ default: m.AdminTabelaDetalhePage })),
);
const AdminSetoresPage = lazy(() =>
  import('./pages/admin/AdminSetoresPage').then((m) => ({ default: m.AdminSetoresPage })),
);
const AdminCategoriasPage = lazy(() =>
  import('./pages/admin/AdminCategoriasPage').then((m) => ({ default: m.AdminCategoriasPage })),
);
const AdminSetorDetalhePage = lazy(() =>
  import('./pages/admin/AdminSetorDetalhePage').then((m) => ({ default: m.AdminSetorDetalhePage })),
);
const AdminPedidosPage = lazy(() =>
  import('./pages/admin/AdminPedidosPage').then((m) => ({ default: m.AdminPedidosPage })),
);
const AdminPedidoDetalhePage = lazy(() =>
  import('./pages/admin/AdminPedidoDetalhePage').then((m) => ({ default: m.AdminPedidoDetalhePage })),
);
const AdminUsuariosPage = lazy(() =>
  import('./pages/admin/AdminUsuariosPage').then((m) => ({ default: m.AdminUsuariosPage })),
);

const ADMIN: UserType[] = ['ADMIN_COMERCIAL', 'ADMIN_TI'];
const ADMIN_TI: UserType[] = ['ADMIN_TI'];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/minha-conta',
    element: (
      <ProtectedRoute>
        <MinhaContaPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/clientes',
    element: (
      <ProtectedRoute>
        <SelecionarClientePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/pedido/:id',
    element: (
      <ProtectedRoute>
        <PedidoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meus-pedidos',
    element: (
      <ProtectedRoute>
        <MeusPedidosPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meus-clientes',
    element: (
      <ProtectedRoute>
        <MeusClientesPage />
      </ProtectedRoute>
    ),
  },
  {
    // Perfil: vendedor (clientes dos seus setores) e admin (todos) — o
    // servidor é quem decide quem pode ver cada cliente.
    path: '/clientes/:clienteId',
    element: (
      <ProtectedRoute>
        <PerfilClientePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/clientes/:clienteId/historico',
    element: (
      <ProtectedRoute>
        <HistoricoClientePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/produtos',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminProdutosPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/clientes',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminClientesPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/clientes/:id/mix',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminClienteMixPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/categorias',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminCategoriasPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/setores',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminSetoresPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/setores/:id',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminSetorDetalhePage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/empresa',
    element: (
      <RoleRoute permitido={ADMIN_TI}>
        <PaginaLazy>
          <AdminFiliaisPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/tabelas',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminTabelasPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/tabelas/:id',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminTabelaDetalhePage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/pedidos',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminPedidosPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/pedidos/:id',
    element: (
      <RoleRoute permitido={ADMIN}>
        <PaginaLazy>
          <AdminPedidoDetalhePage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  {
    path: '/admin/usuarios',
    element: (
      <RoleRoute permitido={ADMIN_TI}>
        <PaginaLazy>
          <AdminUsuariosPage />
        </PaginaLazy>
      </RoleRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
