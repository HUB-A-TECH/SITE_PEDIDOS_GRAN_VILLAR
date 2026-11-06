import { api } from './api';
import type { UserType } from './types';

/** Perfil escolhido pelo Admin TI. Comercial + Vendedor = uma conta que troca de modo. */
export type Perfil = 'VENDEDOR' | 'ADMIN_COMERCIAL' | 'COMERCIAL_VENDEDOR' | 'ADMIN_TI';

export interface Usuario {
  id: string;
  username: string;
  email: string;
  type: UserType;
  perfil: Perfil;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  local: { id: string; codigo: string; nome: string } | null;
  vendedor: { nomeCompleto: string; telefone: string | null } | null;
}

interface CriarUsuarioPayload {
  perfil: Perfil;
  username: string;
  email: string;
  senha: string;
  nomeCompleto?: string;
  telefone?: string;
  localId?: string;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const res = await api.get<{ usuarios: Usuario[] }>('/admin/usuarios');
  return res.data.usuarios;
}

export async function criarUsuario(payload: CriarUsuarioPayload): Promise<void> {
  await api.post('/admin/usuarios', payload);
}

/**
 * Corrige dados de um usuário existente. Nome e telefone só têm efeito em
 * vendedor (ficam no cadastro do vendedor); para admin, vale só o e-mail.
 * Usuário e filial não mudam por aqui; o perfil muda em `mudarPerfil`.
 */
export async function atualizarUsuario(
  id: string,
  data: { email?: string; nomeCompleto?: string; telefone?: string },
): Promise<void> {
  await api.put(`/admin/usuarios/${id}`, data);
}

/**
 * Muda o perfil entre Vendedor, Comercial e Comercial + Vendedor. Quem passa a
 * vender pela primeira vez precisa de nome completo e filial.
 */
export async function mudarPerfil(
  id: string,
  data: { perfil: Exclude<Perfil, 'ADMIN_TI'>; nomeCompleto?: string; localId?: string },
): Promise<void> {
  await api.patch(`/admin/usuarios/${id}/perfil`, data);
}

export async function alterarAtivo(id: string, ativo: boolean): Promise<void> {
  await api.patch(`/admin/usuarios/${id}/ativo`, { ativo });
}

export async function resetarSenha(id: string, senha: string): Promise<void> {
  await api.post(`/admin/usuarios/${id}/senha`, { senha });
}
