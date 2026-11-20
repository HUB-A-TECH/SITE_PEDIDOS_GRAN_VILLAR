import { Router } from 'express';
import * as controller from './pedidos.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Visualização de pedidos e revisão — administradores.
export const pedidosAdminRoutes = Router();

pedidosAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
pedidosAdminRoutes.get('/', asyncHandler(controller.adminListar));
pedidosAdminRoutes.get('/:id', asyncHandler(controller.adminObterPedido));
pedidosAdminRoutes.post('/:id/aprovar', asyncHandler(controller.adminAprovar));
pedidosAdminRoutes.post('/:id/cancelar', asyncHandler(controller.adminCancelar));
// Confirma de uma vez as alterações feitas na tela de revisão.
pedidosAdminRoutes.post('/:id/revisao', asyncHandler(controller.adminRevisar));
pedidosAdminRoutes.post('/:id/recado', asyncHandler(controller.adminSalvarRecado));
pedidosAdminRoutes.post('/:id/encerrar-aviso', asyncHandler(controller.adminEncerrarAviso));
