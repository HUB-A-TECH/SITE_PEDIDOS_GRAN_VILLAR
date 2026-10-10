import { api } from './api';
import type { Setor, SetorDetalhe } from './types';

/** Setores de uma filial. */
export async function listar(localId: string): Promise<Setor[]> {
  const res = await api.get<{ setores: Setor[] }>('/admin/setores', {
    params: { local_id: localId },
  });
  return res.data.setores;
}

export async function criar(data: { nome: string; localId: string }): Promise<Setor> {
  const res = await api.post<Setor>('/admin/setores', data);
  return res.data;
}

export async function detalhe(id: string): Promise<SetorDetalhe> {
  const res = await api.get<SetorDetalhe>(`/admin/setores/${id}`);
  return res.data;
}

export async function renomear(id: string, nome: string): Promise<Setor> {
  const res = await api.put<Setor>(`/admin/setores/${id}`, { nome });
  return res.data;
}

export async function excluir(id: string): Promise<void> {
  await api.delete(`/admin/setores/${id}`);
}

// As ações abaixo devolvem o detalhe atualizado, para a tela só substituir.

export async function adicionarVendedor(id: string, vendedorId: string): Promise<SetorDetalhe> {
  const res = await api.put<SetorDetalhe>(`/admin/setores/${id}/vendedores/${vendedorId}`);
  return res.data;
}

export async function removerVendedor(id: string, vendedorId: string): Promise<SetorDetalhe> {
  const res = await api.delete<SetorDetalhe>(`/admin/setores/${id}/vendedores/${vendedorId}`);
  return res.data;
}

export async function colocarCliente(id: string, clienteId: string): Promise<SetorDetalhe> {
  const res = await api.put<SetorDetalhe>(`/admin/setores/${id}/clientes/${clienteId}`);
  return res.data;
}

export async function tirarCliente(id: string, clienteId: string): Promise<SetorDetalhe> {
  const res = await api.delete<SetorDetalhe>(`/admin/setores/${id}/clientes/${clienteId}`);
  return res.data;
}
