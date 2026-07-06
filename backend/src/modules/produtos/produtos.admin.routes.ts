import { Router } from 'express';
import * as controller from './produtos.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// CRUD de catálogo — apenas administradores.
export const produtosAdminRoutes = Router();

produtosAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
produtosAdminRoutes.get('/', asyncHandler(controller.adminListar));
produtosAdminRoutes.post('/', asyncHandler(controller.adminCriar));
produtosAdminRoutes.put('/:id', asyncHandler(controller.adminAtualizar));
