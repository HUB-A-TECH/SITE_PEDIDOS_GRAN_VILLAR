import type { UserType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../utils/password';

export function listarUsuarios() {
  return prisma.user.findMany({
    orderBy: [{ type: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      email: true,
      type: true,
      ativo: true,
      criadoEm: true,
      ultimoAcesso: true,
      local: { select: { id: true, codigo: true, nome: true } },
      vendedor: { select: { nomeCompleto: true, telefone: true } },
    },
  });
}

export interface CriarUsuarioInput {
  tipo: UserType;
  username: string;
  email: string;
  senha: string;
  nomeCompleto?: string;
  telefone?: string;
  localId?: string;
}

export async function criarUsuario(input: CriarUsuarioInput) {
  const passwordHash = await hashPassword(input.senha);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        type: input.tipo,
        localId: input.localId ?? null,
      },
    });
    if (input.tipo === 'VENDEDOR') {
      await tx.vendedor.create({
        data: {
          usuarioId: user.id,
          nomeCompleto: input.nomeCompleto!,
          localId: input.localId!,
          telefone: input.telefone ?? null,
        },
      });
    }
    return user;
  });
}

export interface AtualizarUsuarioInput {
  email?: string;
  nomeCompleto?: string;
  telefone?: string;
}

export async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
  return prisma.$transaction(async (tx) => {
    if (input.email) {
      await tx.user.update({ where: { id }, data: { email: input.email } });
    }
    if (input.nomeCompleto !== undefined || input.telefone !== undefined) {
      await tx.vendedor.updateMany({
        where: { usuarioId: id },
        data: {
          ...(input.nomeCompleto !== undefined ? { nomeCompleto: input.nomeCompleto } : {}),
          ...(input.telefone !== undefined ? { telefone: input.telefone } : {}),
        },
      });
    }
    return tx.user.findUnique({ where: { id } });
  });
}

export function definirAtivo(id: string, ativo: boolean) {
  return prisma.user.update({ where: { id }, data: { ativo } });
}

export async function resetarSenha(id: string, senha: string) {
  const passwordHash = await hashPassword(senha);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
