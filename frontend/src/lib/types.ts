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
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  nomeComprador: string | null;
  telefoneComprador: string | null;
  localId: string;
  tabelaPrecoId: string | null;
  setorId: string | null;
  ativo: boolean;
  /** Setor (região) do cliente — vem na lista do vendedor, que agrupa por ele. */
  setor?: { id: string; nome: string; cor?: string; ordem?: number } | null;
}

/** Cliente com os vínculos — só o admin recebe esta versão. */
export interface ClienteCompleto extends Cliente {
  tabelaPreco: { id: string; nome: string } | null;
  /** Setor + vendedores dele (são os que atendem o cliente). */
  setor: { id: string; nome: string; vendedores: VendedorOpcao[] } | null;
}

// ---- Setores (regiões de visita) ----

export interface Setor {
  id: string;
  nome: string;
  /** Cor do cartão no Novo Pedido (ver lib/coresSetor). */
  cor: string;
  ordem: number;
  localId: string;
  vendedores: VendedorOpcao[];
  totalClientes: number;
}

/** Cliente da filial na tela do setor, com o setor em que está hoje. */
export interface ClienteDoSetor {
  id: string;
  codigo: string;
  nome: string;
  nomeFantasia: string | null;
  bairro: string | null;
  cidade: string | null;
  ativo: boolean;
  setor: { id: string; nome: string } | null;
}

export interface SetorDetalhe {
  setor: Setor;
  /** Vendedores da filial que podem atender o setor. */
  vendedores: VendedorOpcao[];
  /** Todos os clientes da filial (os do setor e os que podem entrar). */
  clientes: ClienteDoSetor[];
}

export interface Local {
  id: string;
  codigo: string;
  nome: string;
  /** Dados da empresa que saem no PDF do pedido. */
  telefone?: string | null;
  endereco?: string | null;
  responsavel?: string | null;
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
