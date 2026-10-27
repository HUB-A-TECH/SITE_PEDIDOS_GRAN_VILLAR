import { Router } from 'express';
import * as controller from './categorias.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Categorias do catálogo — Admin Comercial e Admin TI.
export const categoriasAdminRoutes = Router();

categoriasAdminRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);

categoriasAdminRoutes.post('/', asyncHandler(controller.criar));
categoriasAdminRoutes.put('/ordem', asyncHandler(controller.reordenar));
categoriasAdminRoutes.put('/:id', asyncHandler(controller.renomear));
categoriasAdminRoutes.delete('/:id', asyncHandler(controller.excluir));
