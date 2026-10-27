import { Router } from 'express';
import * as controller from './setores.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Setores (regiões de visita) — Admin Comercial e Admin TI.
export const setoresAdminRoutes = Router();

setoresAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);
setoresAdminRoutes.get('/', asyncHandler(controller.listar));
setoresAdminRoutes.post('/', asyncHandler(controller.criar));
setoresAdminRoutes.put('/ordem', asyncHandler(controller.reordenar));
setoresAdminRoutes.get('/:id', asyncHandler(controller.detalhe));
setoresAdminRoutes.put('/:id', asyncHandler(controller.atualizar));
setoresAdminRoutes.delete('/:id', asyncHandler(controller.excluir));

// Quem atende o setor
setoresAdminRoutes.put(
  '/:id/vendedores/:vendedorId',
  asyncHandler(controller.adicionarVendedor),
);
setoresAdminRoutes.delete(
  '/:id/vendedores/:vendedorId',
  asyncHandler(controller.removerVendedor),
);

// Clientes do setor
setoresAdminRoutes.put('/:id/clientes/:clienteId', asyncHandler(controller.colocarCliente));
setoresAdminRoutes.delete('/:id/clientes/:clienteId', asyncHandler(controller.tirarCliente));
