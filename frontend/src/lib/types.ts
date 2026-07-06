export type UserType = 'VENDEDOR' | 'ADMIN_COMERCIAL' | 'ADMIN_TI';

export type Categoria =
  | 'ALHOS'
  | 'PIMENTAS'
  | 'CHAS'
  | 'ERVAS'
  | 'ESPECIARIAS'
  | 'SAIS';

export type UnidadeMedida = 'UND' | 'KG' | 'G' | 'ML' | 'L';

export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  categoria: Categoria;
  descricao: string | null;
  preco: number;
  unidadeMedida: string;
  ativo: boolean;
}

export interface MixProduto {
  id: string;
  codigo: string;
  nome: string;
  categoria: Categoria;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  localId: string;
  ativo: boolean;
}

export interface Local {
  id: string;
  codigo: string;
  nome: string;
}

export const CATEGORIAS: Categoria[] = [
  'ALHOS',
  'PIMENTAS',
  'CHAS',
  'ERVAS',
  'ESPECIARIAS',
  'SAIS',
];

export const UNIDADES: UnidadeMedida[] = ['UND', 'KG', 'G', 'ML', 'L'];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  ALHOS: 'Alhos',
  PIMENTAS: 'Pimentas',
  CHAS: 'Chás',
  ERVAS: 'Ervas',
  ESPECIARIAS: 'Especiarias',
  SAIS: 'Sais',
};
