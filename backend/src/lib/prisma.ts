import { PrismaClient } from '@prisma/client';

// PRISMA_CONTAR_CONSULTAS=1 liga o aviso de cada consulta SQL (usado só pelo
// script de medição em tests/ferramentas). Desligado no site, sem custo.
export const prisma = new PrismaClient(
  process.env.PRISMA_CONTAR_CONSULTAS
    ? { log: [{ emit: 'event', level: 'query' }] }
    : undefined,
);
