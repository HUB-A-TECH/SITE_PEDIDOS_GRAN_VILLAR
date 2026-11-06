import type { Prisma, UserType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../utils/password';
import { perfilDe, perfilVende, type Perfil } from '../../lib/perfil';

export async function listarUsuarios() {
  const usuarios = await prisma.user.findMany({
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
      vendedor: { select: { nomeCompleto: true, telefone: true, ativo: true } },
    },
  });
  return usuarios.map((u) => ({ ...u, perfil: perfilDe(u.type, Boolean(u.vendedor?.ativo)) }));
}

/** Tipo gravado no banco para cada perfil (Comercial + Vendedor = comercial com vendedor ativo). */
const tipoDoPerfil = (p: Perfil): UserType => (p === 'COMERCIAL_VENDEDOR' ? 'ADMIN_COMERCIAL' : p);

export interface CriarUsuarioInput {
  perfil: Perfil;
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
        type: tipoDoPerfil(input.perfil),
        localId: input.localId ?? null,
      },
    });
    if (perfilVende(input.perfil)) {
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

export class PerfilInvalido extends Error {}

/**
 * Admin TI muda o perfil de alguém entre Vendedor, Comercial e Comercial +
 * Vendedor (Admin TI fica de fora: é acesso total e não se mistura).
 *
 * O cadastro de vendedor nunca é apagado — os pedidos antigos apontam para ele.
 * Quando a pessoa deixa de vender, ele só fica inativo (sai das listas de
 * setor); se voltar a vender, é reativado com a mesma carteira e histórico.
 * As sessões abertas num modo que deixou de valer caem sozinhas (middleware).
 */
export async function mudarPerfil(
  id: string,
  perfil: Exclude<Perfil, 'ADMIN_TI'>,
  dadosVendedor: { nomeCompleto?: string; localId?: string },
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id }, include: { vendedor: true } });
    if (!user) throw new PerfilInvalido('Usuário não encontrado');
    if (user.type === 'ADMIN_TI') {
      throw new PerfilInvalido('O perfil de Admin TI não muda por aqui');
    }
    const vende = perfilVende(perfil);
    if (vende && !user.vendedor) {
      if (!dadosVendedor.nomeCompleto || !dadosVendedor.localId) {
        throw new PerfilInvalido('Para vender, informe o nome completo e a filial');
      }
      await tx.vendedor.create({
        data: {
          usuarioId: id,
          nomeCompleto: dadosVendedor.nomeCompleto,
          localId: dadosVendedor.localId,
        },
      });
    } else if (user.vendedor && user.vendedor.ativo !== vende) {
      await tx.vendedor.update({ where: { id: user.vendedor.id }, data: { ativo: vende } });
    }
    const localId = vende ? (user.localId ?? user.vendedor?.localId ?? dadosVendedor.localId) : user.localId;
    await tx.user.update({
      where: { id },
      data: { type: tipoDoPerfil(perfil), localId: localId ?? null },
    });
  });
}

export function definirAtivo(id: string, ativo: boolean) {
  return prisma.user.update({ where: { id }, data: { ativo } });
}

/**
 * Admin TI redefine a senha de alguém (ex.: esqueceu, ou perdeu o celular):
 * as sessões abertas dessa pessoa caem, como na troca feita por ela mesma.
 */
export async function resetarSenha(id: string, senha: string) {
  const passwordHash = await hashPassword(senha);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, senhaAlteradaEm: new Date() },
  });
}
