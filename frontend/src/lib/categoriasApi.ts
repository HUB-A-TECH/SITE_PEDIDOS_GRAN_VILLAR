import { useEffect, useState } from 'react';
import { api } from './api';
import type { CategoriaItem } from './types';

/** Categorias na ordem do admin (é a ordem dos produtos no pedido). */
export async function listar(): Promise<CategoriaItem[]> {
  const res = await api.get<{ categorias: CategoriaItem[] }>('/produtos/categorias');
  return res.data.categorias;
}

export async function criar(nome: string): Promise<CategoriaItem> {
  const res = await api.post<CategoriaItem>('/admin/categorias', { nome });
  return res.data;
}

export async function renomear(id: string, nome: string): Promise<CategoriaItem> {
  const res = await api.put<CategoriaItem>(`/admin/categorias/${id}`, { nome });
  return res.data;
}

/** Grava a ordem (ids na ordem desejada) e devolve a lista atualizada. */
export async function reordenar(ids: string[]): Promise<CategoriaItem[]> {
  const res = await api.put<{ categorias: CategoriaItem[] }>('/admin/categorias/ordem', { ids });
  return res.data.categorias;
}

/** Exclui; os produtos vão para `destinoId` ou ficam sem categoria (null). */
export async function excluir(id: string, destinoId: string | null): Promise<void> {
  await api.delete(`/admin/categorias/${id}`, { data: { destinoId } });
}

export const SEM_CATEGORIA = 'Sem categoria';

/**
 * Lista de categorias para filtros e formulários, mais `nomeDe(id)` para
 * mostrar o nome da categoria de um produto.
 */
export function useCategorias() {
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  useEffect(() => {
    listar().then(setCategorias);
  }, []);
  const nomeDe = (id: string | null | undefined) =>
    categorias.find((c) => c.id === id)?.nome ?? SEM_CATEGORIA;
  return { categorias, nomeDe };
}
