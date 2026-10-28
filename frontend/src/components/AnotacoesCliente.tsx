import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Aviso } from './Aviso';
import { useDialogo } from '../context/DialogoContext';
import * as clientesApi from '../lib/clientesApi';
import type { Anotacao } from '../lib/clientesApi';

const LIMITE = 500;
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const mensagemErro = (e: unknown, padrao: string) =>
  axios.isAxiosError(e) && e.response?.data?.mensagem ? e.response.data.mensagem : padrao;

/** Carrega as anotações do cliente (perfil e tela de pedido usam). */
export function useAnotacoes(clienteId: string) {
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const recarregar = useCallback(() => {
    if (!clienteId) return Promise.resolve();
    return clientesApi
      .listarAnotacoes(clienteId)
      .then(setAnotacoes)
      .catch(() => setAnotacoes([]))
      .finally(() => setCarregando(false));
  }, [clienteId]);
  useEffect(() => {
    setCarregando(true);
    recarregar();
  }, [recarregar]);
  return { anotacoes, carregando, recarregar };
}

/**
 * Recados fixados ("Só entrega às terças"), em destaque. No topo do perfil e
 * na tela do pedido, para o vendedor não esquecer na hora de vender.
 */
export function AnotacoesFixadas({
  anotacoes,
  className = '',
}: {
  anotacoes: Anotacao[];
  className?: string;
}) {
  const fixadas = anotacoes.filter((a) => a.fixada);
  if (fixadas.length === 0) return null;
  return (
    <Aviso tom="atencao" compacto className={className} titulo="Atenção com este cliente">
      <ul className="space-y-1">
        {fixadas.map((a) => (
          <li key={a.id}>
            {a.texto} <span className="text-xs opacity-75">({a.autor})</span>
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

/** Seção "Anotações" do perfil: escrever, fixar, editar e apagar. */
export function SecaoAnotacoes({
  clienteId,
  anotacoes,
  recarregar,
}: {
  clienteId: string;
  anotacoes: Anotacao[];
  recarregar: () => Promise<void>;
}) {
  const dialogo = useDialogo();
  const [texto, setTexto] = useState('');
  const [fixar, setFixar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');

  async function acao(fn: () => Promise<unknown>, padrao: string) {
    setSalvando(true);
    setErro('');
    try {
      await fn();
      await recarregar();
      return true;
    } catch (e) {
      setErro(mensagemErro(e, padrao));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar() {
    if (!texto.trim()) {
      setErro('Escreva a anotação.');
      return;
    }
    const ok = await acao(
      () => clientesApi.criarAnotacao(clienteId, { texto, fixada: fixar }),
      'Não foi possível salvar a anotação.',
    );
    if (ok) {
      setTexto('');
      setFixar(false);
    }
  }

  async function salvarEdicao(a: Anotacao) {
    if (!textoEdicao.trim()) {
      setErro('A anotação não pode ficar vazia.');
      return;
    }
    const ok = await acao(
      () => clientesApi.atualizarAnotacao(clienteId, a.id, { texto: textoEdicao }),
      'Não foi possível editar.',
    );
    if (ok) setEditando(null);
  }

  async function apagar(a: Anotacao) {
    const ok = await dialogo.confirmar({
      titulo: 'Apagar anotação',
      destrutivo: true,
      textoConfirmar: 'Apagar',
      mensagem: `"${a.texto.length > 80 ? `${a.texto.slice(0, 80)}…` : a.texto}" será apagada para todos.`,
    });
    if (ok) await acao(() => clientesApi.apagarAnotacao(clienteId, a.id), 'Não foi possível apagar.');
  }

  return (
    <section className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Anotações</h2>
      <p className="mb-3 text-xs text-slate-500">
        Recados sobre este cliente. Quem atende o cliente e a administração veem.
      </p>

      <label htmlFor="nova-anotacao" className="sr-only">
        Nova anotação
      </label>
      <textarea
        id="nova-anotacao"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value.slice(0, LIMITE));
          if (erro) setErro('');
        }}
        rows={2}
        placeholder="Ex.: comprador só atende de manhã"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={fixar} onChange={(e) => setFixar(e.target.checked)} />
          Fixar no topo (recado importante)
        </label>
        <span className="text-xs text-slate-400">
          {texto.length}/{LIMITE}
        </span>
      </div>
      {erro && (
        <Aviso tom="erro" compacto className="mt-2">
          {erro}
        </Aviso>
      )}
      <button
        onClick={adicionar}
        disabled={salvando}
        className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Adicionar anotação'}
      </button>

      {anotacoes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhuma anotação ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {anotacoes.map((a) => (
            <li key={a.id} className={`py-3 ${a.fixada ? 'rounded-lg bg-brandYellow-50 px-3' : ''}`}>
              {editando === a.id ? (
                <>
                  <label htmlFor={`editar-${a.id}`} className="sr-only">
                    Editar anotação
                  </label>
                  <textarea
                    id={`editar-${a.id}`}
                    value={textoEdicao}
                    onChange={(e) => setTextoEdicao(e.target.value.slice(0, LIMITE))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setEditando(null)}
                      className="flex-1 rounded-lg border border-slate-300 py-1.5 text-sm text-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => salvarEdicao(a)}
                      disabled={salvando}
                      className="flex-1 rounded-lg bg-brand-600 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Salvar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                    {a.fixada && (
                      <span className="mr-1.5 rounded bg-brandYellow-400 px-1.5 py-0.5 text-[10px] font-bold text-brandYellow-900">
                        FIXADA
                      </span>
                    )}
                    {a.texto}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {a.autor} · {dataHoraBR(a.criadoEm)}
                    {a.editadoEm && ` · editado em ${dataHoraBR(a.editadoEm)}`}
                  </p>
                  {(a.podeEditar || a.podeApagar) && (
                    <div className="mt-1 flex gap-3 text-xs font-medium">
                      {a.podeEditar && (
                        <button
                          onClick={() => {
                            setEditando(a.id);
                            setTextoEdicao(a.texto);
                          }}
                          className="text-slate-500 underline decoration-dotted"
                        >
                          editar
                        </button>
                      )}
                      {(a.podeEditar || a.podeApagar) && (
                        <button
                          onClick={() =>
                            acao(
                              () => clientesApi.atualizarAnotacao(clienteId, a.id, { fixada: !a.fixada }),
                              'Não foi possível mudar.',
                            )
                          }
                          disabled={salvando}
                          className="text-slate-500 underline decoration-dotted"
                        >
                          {a.fixada ? 'desafixar' : 'fixar'}
                        </button>
                      )}
                      {a.podeApagar && (
                        <button onClick={() => apagar(a)} className="text-red-600 underline decoration-dotted">
                          apagar
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
