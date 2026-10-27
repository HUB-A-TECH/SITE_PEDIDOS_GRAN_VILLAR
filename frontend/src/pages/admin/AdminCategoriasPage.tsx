import { useEffect, useState } from 'react';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { Modal } from '../../components/Modal';
import { useDialogo } from '../../context/DialogoContext';
import * as categoriasApi from '../../lib/categoriasApi';
import { SEM_CATEGORIA } from '../../lib/categoriasApi';
import type { CategoriaItem } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

function mensagemErro(e: unknown): string {
  return axios.isAxiosError(e) && e.response?.data?.mensagem
    ? e.response.data.mensagem
    : 'Tente novamente.';
}

const qtdProdutos = (n: number) => (n === 1 ? '1 produto' : `${n} produtos`);

/**
 * Categorias do catálogo. A ordem aqui é a ordem em que os produtos aparecem
 * no pedido (dentro de cada categoria, em ordem alfabética).
 */
export function AdminCategoriasPage() {
  const { pedirTexto, avisar } = useDialogo();
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState<CategoriaItem | null>(null);

  useEffect(() => {
    categoriasApi
      .listar()
      .then(setCategorias)
      .finally(() => setCarregando(false));
  }, []);

  async function nova() {
    const nome = await pedirTexto({
      titulo: 'Nova Categoria',
      mensagem: 'Ela entra no fim da lista; use as setas para mudar a posição.',
      rotulo: 'Nome da categoria',
      placeholder: 'Ex.: Temperos',
    });
    if (!nome) return;
    try {
      const criada = await categoriasApi.criar(nome);
      setCategorias((cs) => [...cs, criada]);
    } catch (e) {
      await avisar({ titulo: 'Não foi possível criar', tom: 'erro', mensagem: mensagemErro(e) });
    }
  }

  async function renomear(c: CategoriaItem) {
    const nome = await pedirTexto({
      titulo: 'Renomear categoria',
      rotulo: 'Nome da categoria',
      valorInicial: c.nome,
    });
    if (!nome || nome === c.nome) return;
    try {
      const atualizada = await categoriasApi.renomear(c.id, nome);
      setCategorias((cs) => cs.map((x) => (x.id === c.id ? atualizada : x)));
    } catch (e) {
      await avisar({ titulo: 'Não foi possível renomear', tom: 'erro', mensagem: mensagemErro(e) });
    }
  }

  /** Troca a categoria de lugar com a vizinha (cima = -1, baixo = +1). */
  async function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= categorias.length) return;
    const antes = categorias;
    const nova = [...categorias];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setCategorias(nova);
    try {
      setCategorias(await categoriasApi.reordenar(nova.map((c) => c.id)));
    } catch {
      setCategorias(antes);
      await avisar({ titulo: 'Não foi possível mudar a ordem', tom: 'erro', mensagem: 'Tente novamente.' });
    }
  }

  return (
    <AppLayout
      titulo="Categorias"
      voltarPara="/"
      acao={
        <button
          onClick={nova}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500"
        >
          + Nova
        </button>
      }
    >
      <Aviso className="mb-4">
        Os produtos aparecem no pedido nesta ordem de categorias e, dentro de cada
        uma, em ordem alfabética. Use as setas para mudar a posição.
      </Aviso>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : categorias.length === 0 ? (
        <p className="text-center text-slate-500">
          Nenhuma categoria. Toque em "+ Nova" para criar a primeira.
        </p>
      ) : (
        <ul className="sem-grade space-y-2">
          {categorias.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">
                  {i + 1}. {c.nome}
                </p>
                <p className="text-xs text-slate-500">{qtdProdutos(c.totalProdutos)}</p>
                <div className="mt-2 flex gap-3 text-sm">
                  <button onClick={() => renomear(c)} className="font-medium text-slate-700 hover:underline">
                    Renomear
                  </button>
                  <button onClick={() => setExcluindo(c)} className="font-medium text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label={`Subir ${c.nome}`}
                  className="rounded border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === categorias.length - 1}
                  aria-label={`Descer ${c.nome}`}
                  className="rounded border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {excluindo && (
        <ExcluirCategoria
          categoria={excluindo}
          outras={categorias.filter((c) => c.id !== excluindo.id)}
          onFechar={() => setExcluindo(null)}
          onExcluida={(destinoId) => {
            setCategorias((cs) =>
              cs
                .filter((c) => c.id !== excluindo.id)
                .map((c) =>
                  c.id === destinoId
                    ? { ...c, totalProdutos: c.totalProdutos + excluindo.totalProdutos }
                    : c,
                ),
            );
            setExcluindo(null);
          }}
        />
      )}
    </AppLayout>
  );
}

/** Excluir: pergunta para onde vão os produtos (outra categoria ou nenhuma). */
function ExcluirCategoria({
  categoria,
  outras,
  onFechar,
  onExcluida,
}: {
  categoria: CategoriaItem;
  outras: CategoriaItem[];
  onFechar: () => void;
  onExcluida: (destinoId: string | null) => void;
}) {
  const [destino, setDestino] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const temProdutos = categoria.totalProdutos > 0;

  async function confirmar() {
    setSalvando(true);
    setErro('');
    try {
      const destinoId = destino || null;
      await categoriasApi.excluir(categoria.id, destinoId);
      onExcluida(destinoId);
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Excluir "${categoria.nome}"`} aberto onFechar={onFechar}>
      {temProdutos ? (
        <>
          <p className="mb-3 text-sm text-slate-700">
            Esta categoria tem {qtdProdutos(categoria.totalProdutos)}. Nenhum produto
            será apagado — escolha para onde eles vão:
          </p>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${inputCls} mb-2`}>
            <option value="">{SEM_CATEGORIA} (ficam no fim da lista)</option>
            {outras.map((c) => (
              <option key={c.id} value={c.id}>
                Mover para "{c.nome}"
              </option>
            ))}
          </select>
        </>
      ) : (
        <p className="mb-3 text-sm text-slate-700">Esta categoria não tem produtos.</p>
      )}
      {erro && (
        <Aviso tom="erro" className="mb-2">
          {erro}
        </Aviso>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onFechar}
          className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={salvando}
          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {salvando ? 'Excluindo…' : 'Excluir categoria'}
        </button>
      </div>
    </Modal>
  );
}
