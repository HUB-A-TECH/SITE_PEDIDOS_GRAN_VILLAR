export type UserType = 'VENDEDOR' | 'ADMIN_COMERCIAL' | 'ADMIN_TI';

// Filtro de histórico por quantidade de pedidos (adapta à frequência do cliente).
export type Limite = 6 | 12 | 'tudo';
export const LIMITE_OPCOES: { valor: Limite; label: string }[] = [
  { valor: 6, label: 'Últimos 6' },
  { valor: 12, label: 'Últimos 12' },
  { valor: 'tudo', label: 'Tudo' },
];

export type Categoria =
  | 'ALHOS'
  | 'PIMENTAS'
  | 'CHAS'
  | 'ERVAS'
  | 'ESPECIARIAS'
  | 'SAIS'
  | 'OUTROS';

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
  'OUTROS',
];

export const UNIDADES: UnidadeMedida[] = ['UND', 'KG', 'G', 'ML', 'L'];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  ALHOS: 'Alhos',
  PIMENTAS: 'Pimentas',
  CHAS: 'Chás',
  ERVAS: 'Ervas',
  ESPECIARIAS: 'Especiarias',
  SAIS: 'Sais',
  OUTROS: 'Outros',
};
