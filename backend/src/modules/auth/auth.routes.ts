import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';

export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
