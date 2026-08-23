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
  // Preço que o vendedor vê: vem da tabela de preço do cliente.
  preco: number;
}

// ---- Tabelas de preço ----

export interface TabelaPreco {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  totalClientes?: number;
}

/** Produto dentro de uma tabela. `definido` = a tabela tem preço próprio. */
export interface TabelaProduto {
  id: string;
  codigo: string;
  nome: string;
  categoria: Categoria;
  unidadeMedida: string;
  preco: number;
  precoCatalogo: number;
  definido: boolean;
}

export interface TabelaDetalhe {
  tabela: TabelaPreco;
  clientes: {
    id: string;
    codigo: string;
    nome: string;
    nomeFantasia: string | null;
    ativo: boolean;
  }[];
  produtos: TabelaProduto[];
}

export interface VendedorOpcao {
  id: string;
  nomeCompleto: string;
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
  nomeComprador: string | null;
  telefoneComprador: string | null;
  localId: string;
  tabelaPrecoId: string | null;
  ativo: boolean;
}

/** Cliente com os vínculos — só o admin recebe esta versão. */
export interface ClienteCompleto extends Cliente {
  tabelaPreco: { id: string; nome: string } | null;
  vendedores: VendedorOpcao[];
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
