import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', asyncHandler(authenticate), authController.me);
