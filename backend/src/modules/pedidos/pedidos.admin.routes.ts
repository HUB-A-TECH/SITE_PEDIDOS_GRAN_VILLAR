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
pedidosAdminRoutes.get('/:id/pdf', asyncHandler(controller.baixarPdf));
pedidosAdminRoutes.get('/:id', asyncHandler(controller.adminObterPedido));
pedidosAdminRoutes.post('/:id/aprovar', asyncHandler(controller.adminAprovar));
pedidosAdminRoutes.put('/:id/itens/:itemId', asyncHandler(controller.adminAtualizarItem));
pedidosAdminRoutes.put(
  '/:id/itens/:itemId/preco',
  asyncHandler(controller.adminAtualizarPreco),
);
