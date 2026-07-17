import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { SelecionarClientePage } from './pages/vendedor/SelecionarClientePage';
import { PedidoPage } from './pages/vendedor/PedidoPage';
import { HistoricoClientePage } from './pages/vendedor/HistoricoClientePage';
import { MeusPedidosPage } from './pages/vendedor/MeusPedidosPage';
import { AdminProdutosPage } from './pages/admin/AdminProdutosPage';
import { AdminClientesPage } from './pages/admin/AdminClientesPage';
import { AdminClienteMixPage } from './pages/admin/AdminClienteMixPage';
import { AdminPedidosPage } from './pages/admin/AdminPedidosPage';
import { AdminPedidoDetalhePage } from './pages/admin/AdminPedidoDetalhePage';
import { AdminUsuariosPage } from './pages/admin/AdminUsuariosPage';
import type { UserType } from './lib/types';

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
    path: '/clientes',
    element: (
      <ProtectedRoute>
        <SelecionarClientePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/pedido',
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
        <AdminProdutosPage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin/clientes',
    element: (
      <RoleRoute permitido={ADMIN}>
        <AdminClientesPage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin/clientes/:id/mix',
    element: (
      <RoleRoute permitido={ADMIN}>
        <AdminClienteMixPage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin/pedidos',
    element: (
      <RoleRoute permitido={ADMIN}>
        <AdminPedidosPage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin/pedidos/:id',
    element: (
      <RoleRoute permitido={ADMIN}>
        <AdminPedidoDetalhePage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin/usuarios',
    element: (
      <RoleRoute permitido={ADMIN_TI}>
        <AdminUsuariosPage />
      </RoleRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
