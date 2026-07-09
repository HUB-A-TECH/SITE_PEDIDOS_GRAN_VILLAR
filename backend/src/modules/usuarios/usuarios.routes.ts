import { Router } from 'express';
import * as controller from './usuarios.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Gestão de usuários (administradores e vendedores) — exclusivo do Admin TI.
export const usuariosRoutes = Router();

usuariosRoutes.use(asyncHandler(authenticate), authorize('ADMIN_TI'));

usuariosRoutes.get('/', asyncHandler(controller.listar));
usuariosRoutes.post('/', asyncHandler(controller.criar));
usuariosRoutes.put('/:id', asyncHandler(controller.atualizar));
usuariosRoutes.patch('/:id/ativo', asyncHandler(controller.alterarAtivo));
usuariosRoutes.post('/:id/senha', asyncHandler(controller.resetarSenha));
