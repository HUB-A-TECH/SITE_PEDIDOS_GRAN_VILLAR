import { useMemo, useState } from 'react';
import { Aviso } from './Aviso';
import type { Cliente } from '../lib/types';

interface Props {
  clientes: Cliente[];
  carregando: boolean;
  onEscolher: (c: Cliente) => void;
  /** Cliente sendo aberto agora (mostra "abrindo…" e trava os outros). */
  abrindoId?: string | null;
}

/**
 * Lista de clientes do vendedor, com busca e agrupada por setor (região de
 * visita). Usada em "Novo Pedido" e em "Meus Clientes".
 */
export function ListaClientesPorSetor({ clientes, carregando, onEscolher, abrindoId = null }: Props) {
  const [busca, setBusca] = useState('');

  const grupos = useMemo(() => {
    const termo = busca.toLowerCase();
    const mapa = new Map<string, { nome: string; clientes: Cliente[] }>();
    for (const c of clientes) {
      const texto = `${c.nome} ${c.nomeFantasia ?? ''} ${c.codigo} ${c.bairro ?? ''} ${c.cidade ?? ''}`;
      if (!texto.toLowerCase().includes(termo)) continue;
      const chave = c.setor?.id ?? '';
      if (!mapa.has(chave)) mapa.set(chave, { nome: c.setor?.nome ?? 'Sem setor', clientes: [] });
      mapa.get(chave)!.clientes.push(c);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [clientes, busca]);

  return (
    <>
      <input
        type="search"
        placeholder="Buscar cliente, bairro ou cidade…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : clientes.length === 0 ? (
        <Aviso tom="atencao">
          Você ainda não está em nenhum setor. Fale com o administrador para ser
          colocado na sua região de visitas.
        </Aviso>
      ) : grupos.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum cliente encontrado.</p>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.nome}>
              <h2 className="mb-2 flex items-baseline justify-between text-sm font-bold text-slate-700">
                {g.nome}
                <span className="text-xs font-normal text-slate-500">
                  {g.clientes.length === 1 ? '1 cliente' : `${g.clientes.length} clientes`}
                </span>
              </h2>
              <ul className="space-y-2">
                {g.clientes.map((c) => {
                  const local = [c.bairro, c.cidade].filter(Boolean).join(', ');
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => onEscolher(c)}
                        disabled={abrindoId !== null}
                        className="w-full rounded-xl bg-white p-4 text-left shadow-sm hover:shadow-md disabled:opacity-60"
                      >
                        <p className="font-semibold text-slate-800">{c.nome}</p>
                        <p className="text-sm text-slate-500">
                          {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
                          {c.codigo}
                          {abrindoId === c.id && ' · abrindo…'}
                        </p>
                        {local && <p className="text-xs text-slate-400">{local}</p>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
