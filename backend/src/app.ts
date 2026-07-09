import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { produtosRoutes } from './modules/produtos/produtos.routes';
import { produtosAdminRoutes } from './modules/produtos/produtos.admin.routes';
import { clientesRoutes } from './modules/clientes/clientes.routes';
import { clientesAdminRoutes } from './modules/clientes/clientes.admin.routes';
import { locaisRoutes } from './modules/locais/locais.routes';
import { pedidosRoutes } from './modules/pedidos/pedidos.routes';
import { pedidosAdminRoutes } from './modules/pedidos/pedidos.admin.routes';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/admin/produtos', produtosAdminRoutes);
app.use('/api/admin/clientes', clientesAdminRoutes);
app.use('/api/admin/pedidos', pedidosAdminRoutes);
app.use('/api/admin/usuarios', usuariosRoutes);
app.use('/api/locais', locaisRoutes);

// Em produção, o mesmo serviço serve o site (React já buildado) — mesmo domínio
// da API, o que evita CORS e mantém o cookie de sessão "same-origin".
if (env.nodeEnv === 'production') {
  const frontendDir = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// Handler de erros global (captura exceções não tratadas nos controllers).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ mensagem: 'Erro interno do servidor' });
});
