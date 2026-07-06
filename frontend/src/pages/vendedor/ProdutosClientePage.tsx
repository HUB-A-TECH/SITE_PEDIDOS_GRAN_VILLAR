import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import * as produtosApi from '../../lib/produtosApi';
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
  type Produto,
} from '../../lib/types';

export function ProdutosClientePage() {
  const { clienteId = '' } = useParams();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoria, setCategoria] = useState<Categoria | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);

    const termo = busca.trim();
    const promessa = termo
      ? produtosApi.buscarNoMix(clienteId, termo)
      : produtosApi.listarPorMix(
          clienteId,
          categoria === 'TODAS' ? undefined : categoria,
        );

    promessa
      .then((lista) => {
        if (ativo) setProdutos(lista);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [clienteId, categoria, busca]);

  const formatarPreco = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout titulo="Produtos do Cliente" voltarPara="/clientes">
      <input
        type="search"
        placeholder="Buscar produto no mix…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <CategoriaChip
          ativa={categoria === 'TODAS'}
          onClick={() => setCategoria('TODAS')}
          label="Todas"
        />
        {CATEGORIAS.map((c) => (
          <CategoriaChip
            key={c}
            ativa={categoria === c}
            onClick={() => setCategoria(c)}
            label={CATEGORIA_LABEL[c]}
          />
        ))}
      </div>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="text-center text-slate-500">
          Nenhum produto no mix para este filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {produtos.map((p) => (
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
              <div className="text-right">
                <p className="font-semibold text-slate-800">
                  {formatarPreco(p.preco)}
                </p>
                <p className="text-xs text-slate-500">/ {p.unidadeMedida}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        A criação de pedido a partir daqui chega na Fase 4.
      </p>
    </AppLayout>
  );
}

function CategoriaChip({
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
        ativa
          ? 'bg-slate-800 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
