import { Router } from 'express';
import * as controller from './produtos.controller';
import * as categorias from '../categorias/categorias.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Rotas para vendedor/admin autenticado. Produtos são sempre no contexto do
// mix de um cliente (RN-10/11).
export const produtosRoutes = Router();

produtosRoutes.use(asyncHandler(authenticate));
produtosRoutes.get('/categorias', asyncHandler(categorias.listar));
produtosRoutes.get('/buscar', asyncHandler(controller.buscar));
produtosRoutes.get('/', asyncHandler(controller.listarPorMix));
