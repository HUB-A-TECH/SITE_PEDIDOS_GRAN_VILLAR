import { Router } from 'express';
import * as controller from './tabelas.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Tabelas de preço — apenas administradores.
export const tabelasAdminRoutes = Router();

tabelasAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
tabelasAdminRoutes.get('/', asyncHandler(controller.listar));
tabelasAdminRoutes.post('/', asyncHandler(controller.criar));
tabelasAdminRoutes.get('/:id', asyncHandler(controller.detalhe));
tabelasAdminRoutes.put('/:id', asyncHandler(controller.atualizar));
tabelasAdminRoutes.put(
  '/:id/produtos/:produtoId',
  asyncHandler(controller.definirPreco),
);
