import { useEffect, useState } from 'react';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Campo de quantidade sempre visível (sem botões Adicionar/Remover).
 * Vazio ou 0 = produto não entra no pedido.
 */
export function CampoQuantidade({
  valor,
  unidade,
  desabilitado,
  onChange,
}: {
  valor: number;
  unidade: string;
  desabilitado: boolean;
  onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(valor > 0 ? String(valor) : '');
  useEffect(() => setTexto(valor > 0 ? String(valor) : ''), [valor]);

  function commit() {
    const bruto = texto.trim();
    if (bruto === '') {
      if (valor !== 0) onChange(0);
      return;
    }
    const n = Number(bruto.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) {
      setTexto(valor > 0 ? String(valor) : '');
      return;
    }
    if (n !== valor) onChange(n);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal"
        placeholder="0"
        disabled={desabilitado}
        className="h-10 w-20 rounded-lg border border-slate-300 text-center outline-none focus:border-brand-500"
      />
      <span className="text-xs text-slate-400">{unidade}</span>
    </div>
  );
}

/**
 * Preço unitário do item — editável (ex.: desconto negociado com o cliente).
 * A alteração vale só para este pedido; o catálogo não é afetado. Quando o
 * preço é diferente do catálogo, aparece destacado em dourado.
 */
export function PrecoItem({
  precoCatalogo,
  precoAtual,
  unidade,
  desabilitado,
  onChange,
}: {
  precoCatalogo: number;
  precoAtual: number;
  unidade: string;
  desabilitado: boolean;
  onChange: (v: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(String(precoAtual));
  useEffect(() => setTexto(String(precoAtual)), [precoAtual]);

  const alterado = Math.abs(precoAtual - precoCatalogo) > 0.001;

  function commit() {
    const n = Number(texto.trim().replace(',', '.'));
    if (!Number.isNaN(n) && n > 0 && n !== precoAtual) onChange(n);
    else setTexto(String(precoAtual));
    setEditando(false);
  }

  if (editando) {
    return (
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-xs text-slate-400">R$</span>
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          inputMode="decimal"
          disabled={desabilitado}
          className="h-7 w-20 rounded-md border border-brandYellow-300 bg-brandYellow-50 px-1 text-sm text-brandYellow-800 outline-none focus:border-brandYellow-500"
        />
        <span className="text-xs text-slate-400">/ {unidade}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      disabled={desabilitado}
      className="mt-0.5 flex items-center gap-1.5"
    >
      {alterado ? (
        <span className="rounded-md bg-brandYellow-50 px-1.5 py-0.5 text-xs font-bold text-brandYellow-800 ring-1 ring-inset ring-brandYellow-300">
          {brl(precoAtual)} / {unidade}
        </span>
      ) : (
        <span className="text-xs text-slate-500">
          {brl(precoAtual)} / {unidade}
        </span>
      )}
      <span className="text-xs text-slate-400 underline decoration-dotted">
        {alterado ? 'editar' : 'alterar preço'}
      </span>
    </button>
  );
}
