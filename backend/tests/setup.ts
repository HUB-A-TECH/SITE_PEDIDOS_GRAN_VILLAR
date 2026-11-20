import 'dotenv/config';

// Evita falsos positivos por latência ou despertar do Neon Serverless nos testes.
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '30');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '30');
  }
  process.env.DATABASE_URL = url.toString();
}
