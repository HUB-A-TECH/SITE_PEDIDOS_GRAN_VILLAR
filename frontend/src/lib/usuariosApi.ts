import { api } from './api';
import type { UserType } from './types';

export interface Usuario {
  id: string;
  username: string;
  email: string;
  type: UserType;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  local: { id: string; codigo: string; nome: string } | null;
  vendedor: { nomeCompleto: string; telefone: string | null } | null;
}

export interface CriarUsuarioPayload {
  tipo: UserType;
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

export async function alterarAtivo(id: string, ativo: boolean): Promise<void> {
  await api.patch(`/admin/usuarios/${id}/ativo`, { ativo });
}

export async function resetarSenha(id: string, senha: string): Promise<void> {
  await api.post(`/admin/usuarios/${id}/senha`, { senha });
}
