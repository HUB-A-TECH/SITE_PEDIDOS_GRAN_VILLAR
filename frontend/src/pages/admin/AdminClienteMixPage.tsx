import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import * as clientesApi from '../../lib/clientesApi';
import * as produtosApi from '../../lib/produtosApi';
import {
  type Produto,
} from '../../lib/types';
import { useCategorias } from '../../lib/categoriasApi';
import { useDialogo } from '../../context/DialogoContext';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AdminClienteMixPage() {
  const { id = '' } = useParams();
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [mixIds, setMixIds] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<string>('TODAS');
  const { categorias, nomeDe } = useCategorias();
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState<string | null>(null);
  // Tabela do cliente + preços dela, para o admin ver o que o vendedor verá.
  const [tabelaPreco, setTabelaPreco] = useState<{ nome: string } | null>(null);
  const [precos, setPrecos] = useState<Map<string, number>>(new Map());
  const [emLote, setEmLote] = useState(false);
  const dialogo = useDialogo();

  function aplicarMix(mix: clientesApi.MixResposta) {
    setMixIds(new Set(mix.produtos.map((m) => m.id)));
    setTabelaPreco(mix.tabelaPreco);
    setPrecos(new Map(mix.produtos.map((m) => [m.id, m.preco])));
  }

  useEffect(() => {
    Promise.all([produtosApi.adminListar(), clientesApi.listarMix(id)])
      .then(([produtos, mix]) => {
        setCatalogo(produtos.filter((p) => p.ativo));
        aplicarMix(mix);
      })
      .finally(() => setCarregando(false));
  }, [id]);

  /**
   * Adicionar/remover todos de uma vez — da categoria escolhida no filtro, ou
   * do catálogo inteiro em "Todas". Sempre pergunta antes, com o número exato.
   */
  async function todos(acao: 'adicionar' | 'remover') {
    const categoria = filtro === 'TODAS' ? undefined : filtro;
    const qual = categoria === undefined ? 'produtos' : `produtos de "${nomeDe(categoria)}"`;
    setEmLote(true);
    try {
      const { faltam, noMix } = await clientesApi.contarParaTodos(id, categoria);
      const afetados = acao === 'adicionar' ? faltam : noMix;
      if (afetados === 0) {
        await dialogo.avisar({
          titulo: acao === 'adicionar' ? 'Nada para adicionar' : 'Nada para remover',
          mensagem:
            acao === 'adicionar'
              ? `Todos os ${qual} já estão no mix deste cliente.`
              : `Nenhum dos ${qual} está no mix deste cliente.`,
        });
        return;
      }
      const ok = await dialogo.confirmar({
        titulo: acao === 'adicionar' ? 'Adicionar todos' : 'Remover todos',
        destrutivo: acao === 'remover',
        tom: acao === 'adicionar' ? 'info' : 'atencao',
        textoConfirmar:
          acao === 'adicionar' ? `Adicionar ${afetados}` : `Remover ${afetados}`,
        mensagem:
          acao === 'adicionar'
            ? `Adicionar ${afetados === 1 ? 'o produto que falta' : `os ${afetados} ${qual} que faltam`} no mix deste cliente? O vendedor passa a vê-${afetados === 1 ? 'lo' : 'los'} no pedido.`
            : `Remover ${afetados === 1 ? 'o produto' : `os ${afetados} ${qual}`} do mix deste cliente? O vendedor deixa de vê-${afetados === 1 ? 'lo' : 'los'} no pedido.`,
      });
      if (!ok) return;
      if (acao === 'adicionar') await clientesApi.adicionarTodosAoMix(id, categoria);
      else await clientesApi.removerTodosDoMix(id, categoria);
      aplicarMix(await clientesApi.listarMix(id));
    } catch {
      await dialogo.avisar({
        titulo: 'Não foi possível',
        tom: 'erro',
        mensagem: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setEmLote(false);
    }
  }

  async function alternar(produtoId: string, noMix: boolean) {
    setProcessando(produtoId);
    try {
      if (noMix) {
        await clientesApi.removerDoMix(id, produtoId);
        setMixIds((prev) => {
          const s = new Set(prev);
          s.delete(produtoId);
          return s;
        });
      } else {
        await clientesApi.adicionarAoMix(id, produtoId);
        setMixIds((prev) => new Set(prev).add(produtoId));
        // Busca o preço da tabela do cliente para o item recém-incluído.
        const atualizado = await clientesApi.listarMix(id);
        setPrecos(new Map(atualizado.produtos.map((m) => [m.id, m.preco])));
      }
    } finally {
      setProcessando(null);
    }
  }

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return catalogo.filter((p) => {
      const okCat = filtro === 'TODAS' || p.categoria === filtro;
      const okBusca =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        p.codigo.toLowerCase().includes(termo);
      return okCat && okBusca;
    });
  }, [catalogo, filtro, busca]);

  return (
    <AppLayout titulo="Mix do Cliente" voltarPara="/admin/clientes">
      <Aviso className="mb-3">
        Marque quais produtos este cliente compra. Só os do mix aparecem para o
        vendedor.
      </Aviso>

      <Aviso tom="dica" className="mb-3" titulo="Preços deste cliente">
        {tabelaPreco?.nome ?? 'Sem tabela — usando o preço do catálogo'}
      </Aviso>

      <input
        type="search"
        placeholder="Buscar no catálogo…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip ativa={filtro === 'TODAS'} onClick={() => setFiltro('TODAS')} label="Todas" />
        {categorias.map(({ id: c }) => (
          <Chip
            key={c}
            ativa={filtro === c}
            onClick={() => setFiltro(c)}
            label={nomeDe(c)}
          />
        ))}
      </div>

      {!carregando && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => todos('adicionar')}
            disabled={emLote}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
          >
            {filtro === 'TODAS' ? 'Adicionar todos' : `Adicionar todos de ${nomeDe(filtro)}`}
          </button>
          <button
            onClick={() => todos('remover')}
            disabled={emLote}
            className="flex-1 rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {filtro === 'TODAS' ? 'Remover todos' : `Remover todos de ${nomeDe(filtro)}`}
          </button>
        </div>
      )}

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum produto no filtro.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((p) => {
            const noMix = mixIds.has(p.id);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-slate-800">{p.nome}</p>
                  <p className="text-xs text-slate-500">
                    {p.codigo} · {nomeDe(p.categoria)}
                  </p>
                  {noMix && precos.has(p.id) && (
                    <p className="text-xs font-medium text-brand-700">
                      {brl(precos.get(p.id)!)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => alternar(p.id, noMix)}
                  disabled={processando === p.id}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    noMix
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-brand-600 text-white hover:bg-brand-500'
                  }`}
                >
                  {noMix ? 'Remover' : 'Adicionar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppLayout>
  );
}

function Chip({
  ativa,
  onClick,
  label,
}: {
  ativa: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        ativa ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
