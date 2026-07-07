import { Router } from 'express';
import * as controller from './clientes.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Listagem de clientes para o vendedor (restrita ao seu local).
export const clientesRoutes = Router();

clientesRoutes.use(asyncHandler(authenticate));
clientesRoutes.get('/', asyncHandler(controller.listar));
clientesRoutes.get('/:id/historico', asyncHandler(controller.historicoCliente));
clientesRoutes.get(
  '/:id/produtos-historico',
  asyncHandler(controller.produtosHistoricoCliente),
);
