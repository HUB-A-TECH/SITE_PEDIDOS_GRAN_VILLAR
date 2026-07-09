import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as clientesApi from '../../lib/clientesApi';
import * as produtosApi from '../../lib/produtosApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
  type Produto,
} from '../../lib/types';

export function AdminClienteMixPage() {
  const { id = '' } = useParams();
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [mixIds, setMixIds] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Categoria | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([produtosApi.adminListar(), clientesApi.listarMix(id)])
      .then(([produtos, mix]) => {
        setCatalogo(produtos.filter((p) => p.ativo));
        setMixIds(new Set(mix.map((m) => m.id)));
      })
      .finally(() => setCarregando(false));
  }, [id]);

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
      <p className="mb-3 text-sm text-slate-600">
        Marque quais produtos este cliente compra. Só os do mix aparecem para o
        vendedor.
      </p>

      <input
        type="search"
        placeholder="Buscar no catálogo…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip ativa={filtro === 'TODAS'} onClick={() => setFiltro('TODAS')} label="Todas" />
        {CATEGORIAS.map((c) => (
          <Chip
            key={c}
            ativa={filtro === c}
            onClick={() => setFiltro(c)}
            label={CATEGORIA_LABEL[c]}
          />
        ))}
      </div>

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
                    {p.codigo} · {CATEGORIA_LABEL[p.categoria]}
                  </p>
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
