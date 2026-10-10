// Links de contato do perfil do cliente (WhatsApp, telefone, mapa) e as
// iniciais do "avatar". Funções puras, sem React, para dar para testar.

export const apenasDigitos = (s: string) => s.replace(/\D/g, '');

/**
 * Link do WhatsApp (wa.me). Precisa do DDD: números com 10–11 dígitos ganham o
 * 55 do Brasil; sem DDD (8–9 dígitos) não dá para montar, e devolve null.
 */
export function linkWhatsApp(telefone: string): string | null {
  let d = apenasDigitos(telefone);
  // "+" com outro país: o número já vem completo, usa como está.
  if (telefone.trim().startsWith('+') && !d.startsWith('55')) {
    return d.length >= 8 ? `https://wa.me/${d}` : null;
  }
  if (d.startsWith('0')) d = d.slice(1); // "0 11 9…" (prefixo de longa distância)
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith('55') || d.length < 12 || d.length > 13) return null;
  return `https://wa.me/${d}`;
}

export function linkTelefone(telefone: string): string | null {
  const d = apenasDigitos(telefone);
  return d.length >= 8 ? `tel:${d}` : null;
}

/** Busca do endereço no Google Maps (abre o app de mapas no celular). */
export function linkMapa(partes: (string | null | undefined)[]): string | null {
  const texto = partes.filter(Boolean).join(', ');
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null;
}

const LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e', '&']);

/**
 * Iniciais para o "avatar": se o nome começa com uma sigla curta ("BP
 * SUPERMERCADO"), usa a sigla; senão, a primeira letra das duas primeiras
 * palavras, pulando as de ligação ("Casa do Pão" → "CP").
 */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((p) => p && !LIGACAO.has(p.toLowerCase()));
  if (palavras.length === 0) return '?';
  if (palavras.length > 1 && /^[A-Z0-9]{2,3}$/.test(palavras[0])) return palavras[0];
  return palavras
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
