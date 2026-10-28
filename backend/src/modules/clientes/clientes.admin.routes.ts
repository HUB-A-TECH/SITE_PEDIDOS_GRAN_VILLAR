import { Router } from 'express';
import * as controller from './clientes.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// CRUD de clientes + gestão do mix — apenas administradores.
export const clientesAdminRoutes = Router();

clientesAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
clientesAdminRoutes.get('/', asyncHandler(controller.adminListar));
clientesAdminRoutes.post('/', asyncHandler(controller.adminCriar));
clientesAdminRoutes.put('/:id', asyncHandler(controller.adminAtualizar));

// Mix do cliente
clientesAdminRoutes.get('/:id/produtos', asyncHandler(controller.mixListar));
clientesAdminRoutes.post('/:id/produtos', asyncHandler(controller.mixAdicionar));
// "Adicionar/remover todos" (antes de /:produtoId, senão "todos" vira um id).
clientesAdminRoutes.get('/:id/produtos/todos', asyncHandler(controller.mixContarTodos));
clientesAdminRoutes.post('/:id/produtos/todos', asyncHandler(controller.mixAdicionarTodos));
clientesAdminRoutes.delete('/:id/produtos/todos', asyncHandler(controller.mixRemoverTodos));
clientesAdminRoutes.delete(
  '/:id/produtos/:produtoId',
  asyncHandler(controller.mixRemover),
);
