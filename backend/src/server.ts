import { app } from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`API Gran Villar rodando em http://localhost:${env.port}`);
});
