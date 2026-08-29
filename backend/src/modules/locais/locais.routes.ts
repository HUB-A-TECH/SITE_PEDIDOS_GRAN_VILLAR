import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';
import { isNotFoundError } from '../../utils/prisma-errors';

// Filiais: listagem para as telas de admin e edição dos dados da empresa
// (telefone, endereço, responsável) que aparecem no PDF do pedido.
export const locaisRoutes = Router();

locaisRoutes.use(
  asyncHandler(authenticate),
  authorize('ADMIN_COMERCIAL', 'ADMIN_TI'),
);

/** Campos usados nas telas; `codigo` não muda (é a chave do negócio). */
const camposLocal = {
  id: true,
  codigo: true,
  nome: true,
  telefone: true,
  endereco: true,
  responsavel: true,
} as const;

locaisRoutes.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const locais = await prisma.local.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: camposLocal,
    });
    res.json({ locais });
  }),
);

const atualizarSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  // String vazia apaga o dado — é assim que se limpa um campo pela tela.
  telefone: z.string().max(40).optional(),
  endereco: z.string().max(200).optional(),
  responsavel: z.string().max(120).optional(),
});

locaisRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = atualizarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ mensagem: 'Dados inválidos' });
      return;
    }
    const dados = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v?.trim() || null]),
    );
    try {
      const local = await prisma.local.update({
        where: { id: req.params.id },
        data: dados,
        select: camposLocal,
      });
      res.json(local);
    } catch (e) {
      if (isNotFoundError(e)) {
        res.status(404).json({ mensagem: 'Filial não encontrada' });
        return;
      }
      throw e;
    }
  }),
);
