import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Listagem de locais/filiais — usada pelas telas de admin.
export const locaisRoutes = Router();

locaisRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);

locaisRoutes.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const locais = await prisma.local.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, codigo: true, nome: true },
    });
    res.json({ locais });
  }),
);
