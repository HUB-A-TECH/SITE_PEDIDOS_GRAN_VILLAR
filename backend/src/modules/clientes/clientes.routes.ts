import { Router } from 'express';
import * as controller from './clientes.controller';
import * as anotacoes from './anotacoes.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';

// Listagem de clientes para o vendedor (restrita ao seu local).
export const clientesRoutes = Router();

clientesRoutes.use(asyncHandler(authenticate));
clientesRoutes.get('/', asyncHandler(controller.listar));
clientesRoutes.get('/:id/perfil', asyncHandler(controller.perfilCliente));
// Anotações de visita (perfil do cliente).
clientesRoutes.get('/:id/anotacoes', asyncHandler(anotacoes.listar));
clientesRoutes.post('/:id/anotacoes', asyncHandler(anotacoes.criar));
clientesRoutes.put('/:id/anotacoes/:anotacaoId', asyncHandler(anotacoes.atualizar));
clientesRoutes.delete('/:id/anotacoes/:anotacaoId', asyncHandler(anotacoes.excluir));
clientesRoutes.get('/:id/historico', asyncHandler(controller.historicoCliente));
// Mix pelo vendedor na tela de pedido, e o histórico dessas mudanças.
clientesRoutes.get('/:id/fora-do-mix', asyncHandler(controller.foraDoMix));
clientesRoutes.post('/:id/mix', asyncHandler(controller.vendedorAddMix));
clientesRoutes.delete('/:id/mix/:produtoId', asyncHandler(controller.vendedorRemoverMix));
clientesRoutes.get('/:id/historico-mix', asyncHandler(controller.historicoMix));
clientesRoutes.get(
  '/:id/historico-itens',
  asyncHandler(controller.historicoItensCliente),
);
