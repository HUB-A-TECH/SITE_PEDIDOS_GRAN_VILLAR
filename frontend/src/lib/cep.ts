/**
 * Busca de endereço por CEP.
 *
 * Usa o ViaCEP (fonte tradicional, derivada dos Correios) e, se ele falhar ou
 * estiver fora do ar, tenta a BrasilAPI. Duas fontes porque o cadastro de
 * cliente não pode travar por indisponibilidade de um serviço externo — e,
 * se as duas falharem, os campos continuam preenchíveis à mão.
 *
 * Nenhuma das duas exige cadastro ou chave de acesso.
 */

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Deixa só os dígitos: aceita "01310-100", "01310 100" ou "01310100". */
export function apenasDigitos(cep: string): string {
  return cep.replace(/\D/g, '');
}

/** Formata para exibição: 01310100 -> 01310-100. */
export function formatarCep(cep: string): string {
  const d = apenasDigitos(cep).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export class CepNaoEncontrado extends Error {}

async function viaCep(cep: string): Promise<EnderecoCep> {
  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!r.ok) throw new Error('ViaCEP indisponível');
  const d = await r.json();
  // O ViaCEP responde 200 com { erro: true } quando o CEP não existe.
  if (d.erro) throw new CepNaoEncontrado();
  return {
    logradouro: d.logradouro ?? '',
    bairro: d.bairro ?? '',
    cidade: d.localidade ?? '',
    estado: d.uf ?? '',
  };
}

async function brasilApi(cep: string): Promise<EnderecoCep> {
  const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (r.status === 404) throw new CepNaoEncontrado();
  if (!r.ok) throw new Error('BrasilAPI indisponível');
  const d = await r.json();
  return {
    logradouro: d.street ?? '',
    bairro: d.neighborhood ?? '',
    cidade: d.city ?? '',
    estado: d.state ?? '',
  };
}

/**
 * Busca o endereço do CEP. Lança `CepNaoEncontrado` se o CEP não existir, e
 * um Error comum se nenhuma das fontes responder.
 */
export async function buscarCep(cepBruto: string): Promise<EnderecoCep> {
  const cep = apenasDigitos(cepBruto);
  if (cep.length !== 8) throw new CepNaoEncontrado();

  try {
    return await viaCep(cep);
  } catch (e) {
    // CEP inexistente é resposta definitiva — não adianta tentar a outra fonte.
    if (e instanceof CepNaoEncontrado) throw e;
    return brasilApi(cep);
  }
}
