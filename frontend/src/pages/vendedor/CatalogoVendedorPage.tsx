import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import * as produtosApi from '../../lib/produtosApi';
import { useCategorias } from '../../lib/categoriasApi';
import { brl } from '../../lib/formatar';
import type { Produto } from '../../lib/types';

/** Consulta rápida do catálogo completo com os preços da Tabela Padrão. */
export function CatalogoVendedorPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tabelaNome, setTabelaNome] = useState('Tabela Padrão');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string>('TODAS');
  const { categorias, nomeDe } = useCategorias();

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    produtosApi
      .listarCatalogoPadrao()
      .then((res) => {
        setTabelaNome(res.tabelaNome);
        setProdutos(res.produtos);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [tentativa]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const okCat = categoria === 'TODAS' || p.categoria === categoria;
      const okBusca =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        p.codigo.toLowerCase().includes(termo);
      return okCat && okBusca;
    });
  }, [produtos, busca, categoria]);

  return (
    <AppLayout titulo="Catálogo" voltarPara="/">
      <input
        type="search"
        placeholder="Buscar produto por nome ou código…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip ativa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} label="Todas" />
        {categorias.map(({ id: c }) => (
          <Chip
            key={c}
            ativa={categoria === c}
            onClick={() => setCategoria(c)}
            label={nomeDe(c)}
          />
        ))}
      </div>

      {erro ? (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-slate-600">Não foi possível carregar o catálogo. Verifique o sinal.</p>
          <button
            onClick={() => setTentativa((n) => n + 1)}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            Preços da {tabelaNome} · {visiveis.length}{' '}
            {visiveis.length === 1 ? 'produto' : 'produtos'}
          </p>
          {visiveis.length === 0 ? (
            <p className="text-center text-slate-500">Nenhum produto encontrado.</p>
          ) : (
            <ul className="space-y-2">
              {visiveis.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{p.nome}</p>
                    <p className="text-xs text-slate-500">
                      {p.codigo} · {nomeDe(p.categoria)}
                    </p>
                    {p.descricao && (
                      <p className="mt-1 text-xs text-slate-500">{p.descricao}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-brand-700">{brl(p.preco)}</p>
                    <p className="text-xs text-slate-500">por {p.unidadeMedida}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
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
