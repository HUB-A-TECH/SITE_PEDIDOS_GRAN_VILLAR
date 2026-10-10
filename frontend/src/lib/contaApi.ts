import { api } from './api';
import type { Usuario } from '../context/AuthContext';

export interface MinhaConta {
  username: string;
  email: string;
  type: Usuario['type'];
  /** Só vendedor tem nome e telefone. */
  nomeCompleto: string | null;
  telefone: string | null;
}

export async function obter(): Promise<MinhaConta> {
  const res = await api.get<MinhaConta>('/conta');
  return res.data;
}

export async function atualizarDados(dados: {
  email?: string;
  nomeCompleto?: string;
  telefone?: string;
}): Promise<MinhaConta> {
  const res = await api.put<MinhaConta>('/conta/dados', dados);
  return res.data;
}

/** Devolve a conta e o usuário da sessão (para atualizar o topo da tela). */
export async function trocarUsuario(
  username: string,
  senhaAtual: string,
): Promise<MinhaConta & { usuario: Usuario }> {
  const res = await api.put<MinhaConta & { usuario: Usuario }>('/conta/usuario', {
    username,
    senhaAtual,
  });
  return res.data;
}

export async function trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
  await api.put('/conta/senha', { senhaAtual, novaSenha });
}
