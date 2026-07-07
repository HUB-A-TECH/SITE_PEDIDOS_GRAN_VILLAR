import { Router } from 'express';
import * as controller from './pedidos.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Visualização de pedidos e download de TXT — administradores.
export const pedidosAdminRoutes = Router();

pedidosAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
pedidosAdminRoutes.get('/', asyncHandler(controller.adminListar));
pedidosAdminRoutes.get('/:id/txt', asyncHandler(controller.baixarTxt));
