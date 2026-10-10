import { Router } from 'express';
import * as controller from './conta.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// "Minha Conta" — qualquer usuário conectado, sempre sobre a própria conta.
export const contaRoutes = Router();

contaRoutes.use(asyncHandler(authenticate));
contaRoutes.get('/', asyncHandler(controller.obter));
contaRoutes.put('/dados', asyncHandler(controller.atualizarDados));
contaRoutes.put('/usuario', asyncHandler(controller.trocarUsuario));
contaRoutes.put('/senha', asyncHandler(controller.trocarSenha));
