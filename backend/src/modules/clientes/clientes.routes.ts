import { Router } from 'express';
import * as controller from './clientes.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Listagem de clientes para o vendedor (restrita ao seu local).
export const clientesRoutes = Router();

clientesRoutes.use(asyncHandler(authenticate));
clientesRoutes.get('/', asyncHandler(controller.listar));
clientesRoutes.get('/:id/perfil', asyncHandler(controller.perfilCliente));
clientesRoutes.get('/:id/historico', asyncHandler(controller.historicoCliente));
// Mix pelo vendedor na tela de pedido, e o histórico dessas mudanças.
clientesRoutes.get('/:id/fora-do-mix', asyncHandler(controller.foraDoMix));
clientesRoutes.post('/:id/mix', asyncHandler(controller.vendedorAddMix));
clientesRoutes.delete('/:id/mix/:produtoId', asyncHandler(controller.vendedorRemoverMix));
clientesRoutes.get('/:id/historico-mix', asyncHandler(controller.historicoMix));
clientesRoutes.get(
  '/:id/historico-itens',
  asyncHandler(controller.historicoItensCliente),
);
