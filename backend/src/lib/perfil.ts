import type { UserType } from '@prisma/client';

/**
 * Perfil de acesso de uma conta, como o Admin TI escolhe na tela de usuários.
 *
 * "Comercial + Vendedor" não é um tipo novo no banco: é uma conta ADMIN_COMERCIAL
 * que também tem cadastro de vendedor ATIVO. A pessoa usa uma conta só (sem
 * senha compartilhada) e troca de "modo" por um botão. Em cada momento a sessão
 * está em UM modo, gravado no token (`type`), então todas as permissões do
 * sistema continuam valendo como antes: no modo vendedor ela vê só a carteira
 * dela, no modo comercial vê o painel do comercial.
 */
export const PERFIS = ['VENDEDOR', 'ADMIN_COMERCIAL', 'COMERCIAL_VENDEDOR', 'ADMIN_TI'] as const;
export type Perfil = (typeof PERFIS)[number];

export function perfilDe(type: UserType, vendedorAtivo: boolean): Perfil {
  if (type === 'ADMIN_COMERCIAL' && vendedorAtivo) return 'COMERCIAL_VENDEDOR';
  return type;
}

/** Modos em que a conta pode estar. O primeiro é o de entrada (login). */
export function modosDaConta(type: UserType, vendedorAtivo: boolean): UserType[] {
  return perfilDe(type, vendedorAtivo) === 'COMERCIAL_VENDEDOR'
    ? ['ADMIN_COMERCIAL', 'VENDEDOR']
    : [type];
}

/** Perfis que incluem o trabalho de vendedor (precisam de nome e filial). */
export const perfilVende = (p: Perfil) => p === 'VENDEDOR' || p === 'COMERCIAL_VENDEDOR';
