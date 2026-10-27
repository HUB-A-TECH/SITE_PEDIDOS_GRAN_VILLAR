import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { useDialogo } from '../../context/DialogoContext';
import * as setoresApi from '../../lib/setoresApi';
import { CORES_SETOR, paleta, type CorSetor } from '../../lib/coresSetor';
import type { ClienteDoSetor, SetorDetalhe } from '../../lib/types';

type Filtro = 'NESTE' | 'SEM' | 'TODOS';

const mensagemErro = (e: unknown, padrao: string) =>
  axios.isAxiosError(e) && e.response?.data?.mensagem ? e.response.data.mensagem : padrao;

export function AdminSetorDetalhePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirmar, avisar, pedirTexto } = useDialogo();
  const [dados, setDados] = useState<SetorDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('NESTE');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setCarregando(true);
    setoresApi
      .detalhe(id)
      .then((d) => {
        setDados(d);
        // Setor recém-criado (vazio): já abre nos clientes que dá para colocar.
        if (d.setor.totalClientes === 0) {
          setFiltro(d.clientes.some((c) => !c.setor) ? 'SEM' : 'TODOS');
        }
      })
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [id]);

  /** Roda uma ação que devolve o detalhe atualizado, com aviso se falhar. */
  async function executar(chave: string, acao: () => Promise<SetorDetalhe>) {
    setProcessando(chave);
    try {
      setDados(await acao());
    } catch (e) {
      await avisar({ titulo: 'Não foi possível', tom: 'erro', mensagem: mensagemErro(e, 'Tente novamente.') });
    } finally {
      setProcessando(null);
    }
  }

  const clientesVisiveis = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    return dados.clientes.filter((c) => {
      const okFiltro =
        filtro === 'TODOS' ||
        (filtro === 'NESTE' && c.setor?.id === dados.setor.id) ||
        (filtro === 'SEM' && !c.setor);
      const texto = `${c.nome} ${c.nomeFantasia ?? ''} ${c.codigo} ${c.bairro ?? ''} ${c.cidade ?? ''}`;
      return okFiltro && (!termo || texto.toLowerCase().includes(termo));
    });
  }, [dados, filtro, busca]);

  if (carregando) {
    return (
      <AppLayout titulo="Setor" voltarPara="/admin/setores">
        <p className="text-center text-slate-500">Carregando…</p>
      </AppLayout>
    );
  }
  if (!dados) {
    return (
      <AppLayout titulo="Setor" voltarPara="/admin/setores">
        <p className="text-center text-slate-500">Setor não encontrado.</p>
      </AppLayout>
    );
  }

  const { setor } = dados;
  const membros = new Set(setor.vendedores.map((v) => v.id));
  const contagem = {
    NESTE: dados.clientes.filter((c) => c.setor?.id === setor.id).length,
    SEM: dados.clientes.filter((c) => !c.setor).length,
    TODOS: dados.clientes.length,
  };

  async function renomear() {
    const nome = await pedirTexto({
      titulo: 'Renomear setor',
      rotulo: 'Nome do setor',
      valorInicial: setor.nome,
    });
    if (!nome || nome === setor.nome) return;
    try {
      const atualizado = await setoresApi.atualizar(setor.id, { nome });
      setDados((d) => (d ? { ...d, setor: { ...d.setor, nome: atualizado.nome } } : d));
    } catch (e) {
      await avisar({ titulo: 'Não foi possível renomear', tom: 'erro', mensagem: mensagemErro(e, 'Tente novamente.') });
    }
  }

  async function mudarCor(cor: CorSetor) {
    if (cor === setor.cor) return;
    try {
      const atualizado = await setoresApi.atualizar(setor.id, { cor });
      setDados((d) => (d ? { ...d, setor: { ...d.setor, cor: atualizado.cor } } : d));
    } catch (e) {
      await avisar({ titulo: 'Não foi possível mudar a cor', tom: 'erro', mensagem: mensagemErro(e, 'Tente novamente.') });
    }
  }

  async function excluir() {
    const ok = await confirmar({
      titulo: 'Excluir setor',
      destrutivo: true,
      textoConfirmar: 'Excluir',
      mensagem:
        setor.totalClientes === 0
          ? `Excluir o setor "${setor.nome}"?`
          : setor.totalClientes === 1
            ? `O cliente de "${setor.nome}" vai ficar sem setor e não vai aparecer para nenhum vendedor até você colocá-lo em outro setor.`
            : `Os ${setor.totalClientes} clientes de "${setor.nome}" vão ficar sem setor e não vão aparecer para nenhum vendedor até você colocá-los em outro setor.`,
    });
    if (!ok) return;
    try {
      await setoresApi.excluir(setor.id);
      navigate('/admin/setores');
    } catch (e) {
      await avisar({ titulo: 'Não foi possível excluir', tom: 'erro', mensagem: mensagemErro(e, 'Tente novamente.') });
    }
  }

  async function colocar(c: ClienteDoSetor) {
    // Cliente fica em um setor só: se está em outro, avisa que vai sair de lá.
    if (c.setor) {
      const ok = await confirmar({
        titulo: 'Mudar de setor',
        textoConfirmar: 'Mudar',
        mensagem: `"${c.nome}" está no setor "${c.setor.nome}". Ele vai sair de lá e passar para "${setor.nome}", e os vendedores de lá deixam de vê-lo.`,
      });
      if (!ok) return;
    }
    await executar(`c-${c.id}`, () => setoresApi.colocarCliente(setor.id, c.id));
  }

  return (
    <AppLayout titulo={setor.nome} voltarPara="/admin/setores">
      <div className={`mb-4 rounded-xl border-l-8 bg-white p-4 shadow-sm ${paleta(setor.cor).borda}`}>
        <p className="font-semibold text-slate-800">{setor.nome}</p>
        <p className="text-xs text-slate-500">
          {contagem.NESTE === 1 ? '1 cliente' : `${contagem.NESTE} clientes`} ·{' '}
          {setor.vendedores.length === 1 ? '1 vendedor' : `${setor.vendedores.length} vendedores`}
        </p>
        <p className="mt-3 text-xs font-medium text-slate-600">
          Cor do setor (é a cor que o vendedor vê no Novo Pedido)
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(CORES_SETOR) as CorSetor[]).map((cor) => {
            const p = CORES_SETOR[cor];
            const atual = setor.cor === cor;
            return (
              <button
                key={cor}
                onClick={() => mudarCor(cor)}
                aria-pressed={atual}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  atual ? 'border-slate-800 bg-slate-100 text-slate-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${p.bolinha}`} />
                {p.nome}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={renomear}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Renomear
          </button>
          <button
            onClick={excluir}
            className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Excluir setor
          </button>
        </div>
      </div>

      {/* ---- Vendedores ---- */}
      <h2 className="mb-2 text-sm font-bold text-slate-700">Vendedores que visitam este setor</h2>
      {setor.vendedores.length === 0 && (
        <Aviso tom="atencao" compacto className="mb-2">
          Sem vendedor, os clientes deste setor não aparecem para ninguém.
        </Aviso>
      )}
      {dados.vendedores.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">
          Nenhum vendedor cadastrado. Cadastre em Usuários.
        </p>
      ) : (
        <ul className="mb-6 space-y-2">
          {dados.vendedores.map((v) => {
            const noSetor = membros.has(v.id);
            const chave = `v-${v.id}`;
            return (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm"
              >
                <p className={`text-sm ${noSetor ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {v.nomeCompleto}
                </p>
                <button
                  onClick={() =>
                    executar(chave, () =>
                      noSetor
                        ? setoresApi.removerVendedor(setor.id, v.id)
                        : setoresApi.adicionarVendedor(setor.id, v.id),
                    )
                  }
                  disabled={processando === chave}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    noSetor
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-brand-600 text-white hover:bg-brand-500'
                  }`}
                >
                  {noSetor ? 'Remover' : 'Adicionar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Clientes ---- */}
      <h2 className="mb-2 text-sm font-bold text-slate-700">Clientes</h2>
      <input
        type="search"
        placeholder="Buscar por nome, código, bairro ou cidade…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip ativa={filtro === 'NESTE'} onClick={() => setFiltro('NESTE')} label={`Neste setor (${contagem.NESTE})`} />
        <Chip ativa={filtro === 'SEM'} onClick={() => setFiltro('SEM')} label={`Sem setor (${contagem.SEM})`} />
        <Chip ativa={filtro === 'TODOS'} onClick={() => setFiltro('TODOS')} label={`Todos (${contagem.TODOS})`} />
      </div>

      {clientesVisiveis.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          {filtro === 'NESTE' && !busca
            ? 'Nenhum cliente neste setor ainda. Veja "Sem setor" ou "Todos" para adicionar.'
            : 'Nenhum cliente encontrado.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {clientesVisiveis.map((c) => {
            const aqui = c.setor?.id === setor.id;
            const chave = `c-${c.id}`;
            const local = [c.bairro, c.cidade].filter(Boolean).join(', ');
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {c.nome}
                    {!c.ativo && (
                      <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.codigo}
                    {local ? ` · ${local}` : ''}
                  </p>
                  {!aqui && (
                    <p className="text-xs text-slate-400">
                      {c.setor ? `Está em: ${c.setor.nome}` : 'Sem setor'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    aqui
                      ? executar(chave, () => setoresApi.tirarCliente(setor.id, c.id))
                      : colocar(c)
                  }
                  disabled={processando === chave}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    aqui
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-brand-600 text-white hover:bg-brand-500'
                  }`}
                >
                  {aqui ? 'Tirar' : 'Colocar aqui'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppLayout>
  );
}

function Chip({ ativa, onClick, label }: { ativa: boolean; onClick: () => void; label: string }) {
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
