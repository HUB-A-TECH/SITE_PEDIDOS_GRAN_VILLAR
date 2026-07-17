import { Router } from 'express';
import * as controller from './pedidos.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Pedidos do vendedor (rascunho, itens, observações).
export const pedidosRoutes = Router();

pedidosRoutes.use(asyncHandler(authenticate));

pedidosRoutes.get('/historico', asyncHandler(controller.meuHistorico));
pedidosRoutes.get('/rascunho', asyncHandler(controller.obterRascunho));
pedidosRoutes.post('/', asyncHandler(controller.criar));
pedidosRoutes.delete('/:id', asyncHandler(controller.excluir));

pedidosRoutes.post('/:id/itens', asyncHandler(controller.adicionarItem));
pedidosRoutes.put('/:id/itens/:itemId', asyncHandler(controller.atualizarItem));
pedidosRoutes.put('/:id/itens/:itemId/preco', asyncHandler(controller.atualizarPreco));
pedidosRoutes.delete('/:id/itens/:itemId', asyncHandler(controller.removerItem));

pedidosRoutes.put('/:id/observacoes', asyncHandler(controller.atualizarObservacoes));

pedidosRoutes.post('/:id/confirmar', asyncHandler(controller.confirmar));
pedidosRoutes.post('/:id/cancelar', asyncHandler(controller.cancelar));
pedidosRoutes.get('/:id/txt', asyncHandler(controller.baixarTxt));
pedidosRoutes.get('/:id/pdf', asyncHandler(controller.baixarPdf));
