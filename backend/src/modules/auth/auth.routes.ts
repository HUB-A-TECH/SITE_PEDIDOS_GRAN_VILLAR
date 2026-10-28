import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';
import { limiteLogin } from '../../middleware/limite-tentativas';

export const authRoutes = Router();

authRoutes.post('/login', limiteLogin, asyncHandler(authController.login));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', asyncHandler(authenticate), asyncHandler(authController.me));
