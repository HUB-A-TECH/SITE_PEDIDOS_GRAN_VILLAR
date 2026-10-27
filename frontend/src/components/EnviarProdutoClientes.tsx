import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Aviso } from './Aviso';
import * as clientesApi from '../lib/clientesApi';
import * as produtosApi from '../lib/produtosApi';
import type { ClienteCompleto, Produto } from '../lib/types';

type Modo = 'escolha' | 'selecionar';

/**
 * Depois de cadastrar um produto: enviar para o mix de todos os clientes, de
 * alguns, ou de nenhum por enquanto.
 */
export function EnviarProdutoClientes({
  produto,
  onConcluir,
}: {
  produto: Produto;
  onConcluir: () => void;
}) {
  const [modo, setModo] = useState<Modo>('escolha');
  const [clientes, setClientes] = useState<ClienteCompleto[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviados, setEnviados] = useState<number | null>(null);

  // A lista só é buscada quando o admin decide escolher os clientes.
  useEffect(() => {
    if (modo !== 'selecionar' || clientes) return;
    clientesApi
      .listarLocais()
      .then((ls) => Promise.all(ls.map((l) => clientesApi.adminListar(l.id))))
      .then((listas) => setClientes(listas.flat().filter((c) => c.ativo)));
  }, [modo, clientes]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (clientes ?? []).filter((c) =>
      `${c.nome} ${c.nomeFantasia ?? ''} ${c.codigo} ${c.setor?.nome ?? ''}`
        .toLowerCase()
        .includes(termo),
    );
  }, [clientes, busca]);

  async function enviar(alvo: { todos: true } | { clienteIds: string[] }) {
    setSalvando(true);
    setErro('');
    try {
      setEnviados(await produtosApi.enviarParaClientes(produto.id, alvo));
    } catch (e) {
      setErro(
        axios.isAxiosError(e) && e.response?.data?.mensagem
          ? e.response.data.mensagem
          : 'Não foi possível enviar. Tente novamente.',
      );
    } finally {
      setSalvando(false);
    }
  }

  function alternar(id: string) {
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const botao =
    'w-full rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60';

  if (enviados !== null) {
    return (
      <div className="space-y-3">
        <Aviso tom="dica" titulo="Pronto!">
          "{produto.nome}" foi para o mix de{' '}
          {enviados === 1 ? '1 cliente' : `${enviados} clientes`}.
        </Aviso>
        <button
          onClick={onConcluir}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-500"
        >
          Concluir
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Aviso tom="dica" titulo="Produto cadastrado">
        Para quais clientes "{produto.nome}" deve aparecer?
      </Aviso>
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {modo === 'escolha' ? (
        <>
          <button onClick={() => enviar({ todos: true })} disabled={salvando} className={botao}>
            <p className="font-semibold text-slate-800">Enviar para todos os clientes</p>
            <p className="text-xs text-slate-500">Entra no mix de todos os clientes ativos</p>
          </button>
          <button onClick={() => setModo('selecionar')} disabled={salvando} className={botao}>
            <p className="font-semibold text-slate-800">Escolher clientes</p>
            <p className="text-xs text-slate-500">Marque só os clientes que vão receber</p>
          </button>
          <button onClick={onConcluir} disabled={salvando} className={botao}>
            <p className="font-semibold text-slate-800">Nenhum por enquanto</p>
            <p className="text-xs text-slate-500">Depois dá para colocar no mix de cada cliente</p>
          </button>
        </>
      ) : (
        <>
          <input
            type="search"
            placeholder="Buscar cliente ou setor…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {clientes === null ? (
            <p className="text-center text-sm text-slate-500">Carregando…</p>
          ) : (
            <>
              <div className="flex justify-between text-xs">
                <button
                  onClick={() => setMarcados(new Set([...marcados, ...visiveis.map((c) => c.id)]))}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Marcar todos da lista
                </button>
                <button onClick={() => setMarcados(new Set())} className="text-slate-500 hover:underline">
                  Desmarcar todos
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {visiveis.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={marcados.has(c.id)}
                        onChange={() => alternar(c.id)}
                        className="h-4 w-4"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{c.nome}</span>
                        <span className="block text-xs text-slate-500">
                          {c.codigo}
                          {c.setor ? ` · ${c.setor.nome}` : ' · Sem setor'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setModo('escolha')}
              disabled={salvando}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Voltar
            </button>
            <button
              onClick={() => enviar({ clienteIds: [...marcados] })}
              disabled={salvando || marcados.size === 0}
              className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {salvando
                ? 'Enviando…'
                : `Enviar para ${marcados.size === 1 ? '1 cliente' : `${marcados.size} clientes`}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
