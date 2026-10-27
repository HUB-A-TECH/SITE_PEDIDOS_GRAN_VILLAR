import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { ListaClientesPorSetor } from '../../components/ListaClientesPorSetor';
import * as clientesApi from '../../lib/clientesApi';
import * as pedidosApi from '../../lib/pedidosApi';
import { paleta } from '../../lib/coresSetor';
import type { Cliente } from '../../lib/types';

interface CartaoSetor {
  /** id do setor ('' = clientes sem setor). */
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  total: number;
}

/**
 * Novo Pedido: primeiro o vendedor escolhe o setor (cartões coloridos, na
 * ordem do admin — cada cor é a região de uma semana), depois o mercado.
 * O setor escolhido fica na URL (?setor=) para o "voltar" cair nele.
 */
export function SelecionarClientePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [iniciando, setIniciando] = useState<string | null>(null);

  useEffect(() => {
    clientesApi
      .listar()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

  const cartoes = useMemo(() => {
    const mapa = new Map<string, CartaoSetor>();
    for (const c of clientes) {
      const id = c.setor?.id ?? '';
      const atual = mapa.get(id);
      if (atual) atual.total++;
      else
        mapa.set(id, {
          id,
          nome: c.setor?.nome ?? 'Sem setor',
          cor: c.setor?.cor ?? null,
          ordem: c.setor?.ordem ?? Number.MAX_SAFE_INTEGER,
          total: 1,
        });
    }
    return [...mapa.values()].sort(
      (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }, [clientes]);

  // Com um setor só não há o que escolher: vai direto para os mercados.
  const setorParam = params.get('setor');
  const escolhido =
    cartoes.length === 1 ? cartoes[0] : cartoes.find((c) => c.id === setorParam) ?? null;

  async function iniciarPedido(cliente: Cliente) {
    setIniciando(cliente.id);
    try {
      // Retoma o pedido salvo desse cliente, se houver, ou cria um novo.
      const pedido = await pedidosApi.criar(cliente.id);
      navigate(`/pedido/${pedido.id}`);
    } finally {
      setIniciando(null);
    }
  }

  if (!carregando && cartoes.length > 1 && !escolhido) {
    return (
      <AppLayout titulo="Novo Pedido" voltarPara="/">
        <p className="mb-3 text-sm text-slate-600">Escolha o setor que você vai visitar:</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cartoes.map((s) => {
            const p = paleta(s.cor);
            return (
              <button
                key={s.id || 'sem-setor'}
                onClick={() => setParams({ setor: s.id })}
                className={`rounded-2xl p-5 text-left shadow-sm transition hover:shadow-md active:scale-[0.98] ${p.fundo} ${p.texto}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  {s.cor ? p.nome : 'Sem cor'}
                </p>
                <p className="mt-1 text-xl font-bold">{s.nome}</p>
                <p className="mt-2 text-sm opacity-90">
                  {s.total === 1 ? '1 mercado' : `${s.total} mercados`}
                </p>
              </button>
            );
          })}
        </div>
      </AppLayout>
    );
  }

  const p = paleta(escolhido?.cor);
  const doSetor = escolhido ? clientes.filter((c) => (c.setor?.id ?? '') === escolhido.id) : clientes;

  return (
    <AppLayout
      titulo="Selecionar Cliente"
      voltarPara={cartoes.length > 1 ? '/clientes' : '/'}
    >
      {escolhido && (
        // Faixa da cor: o vendedor sempre sabe em que setor está.
        <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-3 ${p.fundo} ${p.texto}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Setor {escolhido.cor ? p.nome : ''}
            </p>
            <p className="text-lg font-bold">{escolhido.nome}</p>
          </div>
          {cartoes.length > 1 && (
            <button
              onClick={() => setParams({})}
              className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
            >
              Trocar
            </button>
          )}
        </div>
      )}
      <ListaClientesPorSetor
        clientes={doSetor}
        carregando={carregando}
        onEscolher={iniciarPedido}
        abrindoId={iniciando}
      />
    </AppLayout>
  );
}
