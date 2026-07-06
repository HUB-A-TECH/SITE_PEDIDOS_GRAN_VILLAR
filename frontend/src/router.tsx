import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { SelecionarClientePage } from './pages/vendedor/SelecionarClientePage';
import { ProdutosClientePage } from './pages/vendedor/ProdutosClientePage';
import { AdminProdutosPage } from './pages/admin/AdminProdutosPage';
import { AdminClientesPage } from './pages/admin/AdminClientesPage';
import { AdminClienteMixPage } from './pages/admin/AdminClienteMixPage';
import type { UserType } from './lib/types';

const ADMIN: UserType[] = ['ADMIN_COMERCIAL', 'ADMIN_TI'];

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
    path: '/clientes/:clienteId/produtos',
    element: (
      <ProtectedRoute>
        <ProdutosClientePage />
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
  { path: '*', element: <Navigate to="/" replace /> },
]);
