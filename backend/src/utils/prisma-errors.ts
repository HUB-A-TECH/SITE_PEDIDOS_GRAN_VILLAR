import { Prisma } from '@prisma/client';

/** Violação de restrição única (ex.: código duplicado). */
export function isUniqueConstraintError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

/** Registro não encontrado em update/delete. */
export function isNotFoundError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}
