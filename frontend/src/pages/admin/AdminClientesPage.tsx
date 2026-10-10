import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Aviso } from '../../components/Aviso';
import {
  apenasDigitos,
  buscarCep,
  CepNaoEncontrado,
  formatarCep,
} from '../../lib/cep';
import * as clientesApi from '../../lib/clientesApi';
import * as setoresApi from '../../lib/setoresApi';
import * as tabelasApi from '../../lib/tabelasApi';
import type { ClienteCompleto, Local, Setor, TabelaPreco } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

export function AdminClientesPage() {
  const navigate = useNavigate();
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState('');
  const [clientes, setClientes] = useState<ClienteCompleto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<ClienteCompleto | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  useEffect(() => {
    clientesApi.listarLocais().then((ls) => {
      setLocais(ls);
      if (ls.length > 0) setLocalId(ls[0].id);
    });
    tabelasApi.listar().then(setTabelas);
  }, []);

  // Setores do cadastro são os da filial selecionada.
  useEffect(() => {
    if (!localId) return;
    setoresApi.listar(localId).then(setSetores);
  }, [localId]);

  async function carregar(id: string) {
    if (!id) return;
    setCarregando(true);
    const lista = await clientesApi.adminListar(id);
    setClientes(lista);
    setCarregando(false);
  }

  useEffect(() => {
    if (localId) carregar(localId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEdicao(c: ClienteCompleto) {
    setEditando(c);
    setModalAberto(true);
  }
  async function aoSalvar() {
    setModalAberto(false);
    await carregar(localId);
  }

  return (
    <AppLayout
      titulo="Clientes"
      voltarPara="/"
      acao={
        <button
          onClick={abrirNovo}
          disabled={!localId}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500 disabled:opacity-50"
        >
          + Novo
        </button>
      }
    >
      <select
        value={localId}
        onChange={(e) => setLocalId(e.target.value)}
        className={`${inputCls} mb-4`}
      >
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome} ({l.codigo})
          </option>
        ))}
      </select>

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-center text-slate-500">Nenhum cliente neste local.</p>
      ) : (
        <ul className="space-y-2">
          {clientes.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    {c.nome}{' '}
                    {!c.ativo && (
                      <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
                    {c.codigo}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">
                      {c.tabelaPreco?.nome ?? 'Sem tabela de preço'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {!c.setor
                      ? 'Sem setor: nenhum vendedor vê este cliente'
                      : c.setor.vendedores.length === 0
                        ? `Setor: ${c.setor.nome} · sem vendedor`
                        : `Setor: ${c.setor.nome} · ${c.setor.vendedores
                            .map((v) => v.nomeCompleto)
                            .join(', ')}`}
                  </p>
                </div>
                <button
                  onClick={() => abrirEdicao(c)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Editar
                </button>
              </div>
              <button
                onClick={() => navigate(`/clientes/${c.id}`)}
                className="mt-3 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Ver perfil do cliente →
              </button>
              <button
                onClick={() => navigate(`/admin/clientes/${c.id}/mix`)}
                className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Gerenciar mix de produtos →
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo={editando ? 'Editar Cliente' : 'Novo Cliente'}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <ClienteForm
          cliente={editando}
          localId={localId}
          tabelas={tabelas}
          setores={setores}
          onSalvar={aoSalvar}
        />
      </Modal>
    </AppLayout>
  );
}

function ClienteForm({
  cliente,
  localId,
  tabelas,
  setores,
  onSalvar,
}: {
  cliente: ClienteCompleto | null;
  localId: string;
  tabelas: TabelaPreco[];
  setores: Setor[];
  onSalvar: () => void;
}) {
  const [codigo, setCodigo] = useState(cliente?.codigo ?? '');
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia ?? '');
  const [cnpj, setCnpj] = useState(cliente?.cnpj ?? '');
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '');
  const [email, setEmail] = useState(cliente?.email ?? '');
  const [nomeComprador, setNomeComprador] = useState(cliente?.nomeComprador ?? '');
  const [telefoneComprador, setTelefoneComprador] = useState(
    cliente?.telefoneComprador ?? '',
  );
  const [cep, setCep] = useState(formatarCep(cliente?.cep ?? ''));
  const [logradouro, setLogradouro] = useState(cliente?.logradouro ?? '');
  const [numero, setNumero] = useState(cliente?.numero ?? '');
  const [complemento, setComplemento] = useState(cliente?.complemento ?? '');
  const [bairro, setBairro] = useState(cliente?.bairro ?? '');
  const [cidade, setCidade] = useState(cliente?.cidade ?? '');
  const [estado, setEstado] = useState(cliente?.estado ?? '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState('');
  const [tabelaPrecoId, setTabelaPrecoId] = useState(
    cliente?.tabelaPrecoId ?? tabelas[0]?.id ?? '',
  );
  const [setorId, setSetorId] = useState(cliente?.setorId ?? '');
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const setorEscolhido = setores.find((s) => s.id === setorId);

  /**
   * Busca o endereço assim que o CEP fica completo (8 dígitos). Preenche
   * logradouro/bairro/cidade/UF e leva o foco para o número, que é o único
   * campo que o CEP não sabe.
   */
  async function preencherPeloCep(valor: string) {
    const digitos = apenasDigitos(valor);
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    setErroCep('');
    try {
      const e = await buscarCep(digitos);
      setLogradouro(e.logradouro);
      setBairro(e.bairro);
      setCidade(e.cidade);
      setEstado(e.estado);
      document.getElementById('cliente-numero')?.focus();
    } catch (e) {
      setErroCep(
        e instanceof CepNaoEncontrado
          ? 'CEP não encontrado. Confira ou preencha o endereço à mão.'
          : 'Não foi possível consultar o CEP agora. Preencha à mão.',
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const dados = {
        codigo: codigo.trim(),
        nome: nome.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        nomeComprador: nomeComprador.trim() || undefined,
        telefoneComprador: telefoneComprador.trim() || undefined,
        // CEP vai só com os dígitos; a máscara existe apenas na tela.
        cep: apenasDigitos(cep) || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        estado: estado.trim().toUpperCase() || undefined,
        tabelaPrecoId: tabelaPrecoId || undefined,
        setorId: setorId || null,
      };
      if (cliente) {
        await clientesApi.adminAtualizar(cliente.id, { ...dados, ativo });
      } else {
        await clientesApi.adminCriar({ ...dados, localId });
      }
      onSalvar();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.mensagem) {
        setErro(err.response.data.mensagem);
      } else {
        setErro('Não foi possível salvar.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Campo label="Código">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Nome / Razão social">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </Campo>
      <Campo label="Nome fantasia (opcional)">
        <input
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          className={inputCls}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="CNPJ (opcional)">
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefone (opcional)">
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo label="E-mail (opcional)">
        {/* type="email" faz o próprio navegador avisar se o formato estiver
            errado, antes de enviar — o servidor também valida. */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="compras@empresa.com.br"
          className={inputCls}
        />
      </Campo>

      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Endereço
        </legend>

        <Campo label="CEP">
          <div className="flex items-center gap-2">
            <input
              value={cep}
              onChange={(e) => {
                const formatado = formatarCep(e.target.value);
                setCep(formatado);
                if (erroCep) setErroCep('');
                // Busca sozinho assim que completa os 8 dígitos.
                if (apenasDigitos(formatado).length === 8) {
                  preencherPeloCep(formatado);
                }
              }}
              onBlur={() => preencherPeloCep(cep)}
              inputMode="numeric"
              placeholder="00000-000"
              maxLength={9}
              className={`${inputCls} max-w-[10rem]`}
            />
            {buscandoCep && (
              <span className="text-xs text-slate-500">buscando…</span>
            )}
          </div>
        </Campo>

        {erroCep && (
          <Aviso tom="atencao" compacto className="mt-2">
            {erroCep}
          </Aviso>
        )}

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Campo label="Logradouro">
              <input
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                placeholder="Rua, avenida…"
                className={inputCls}
              />
            </Campo>
          </div>
          <Campo label="Número">
            <input
              id="cliente-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Campo label="Complemento (opcional)">
            <input
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Sala, galpão…"
              className={inputCls}
            />
          </Campo>
          <Campo label="Bairro">
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Campo label="Cidade">
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>
          <Campo label="UF">
            <input
              value={estado}
              onChange={(e) =>
                setEstado(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())
              }
              maxLength={2}
              placeholder="SP"
              className={`${inputCls} uppercase`}
            />
          </Campo>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nome do comprador (opcional)">
          <input
            value={nomeComprador}
            onChange={(e) => setNomeComprador(e.target.value)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefone do comprador (opcional)">
          <input
            value={telefoneComprador}
            onChange={(e) => setTelefoneComprador(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo label="Tabela de preço">
        <select
          value={tabelaPrecoId}
          onChange={(e) => setTabelaPrecoId(e.target.value)}
          className={inputCls}
        >
          {tabelas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
          <option value="">Sem tabela (usa o preço do catálogo)</option>
        </select>
      </Campo>

      <Campo label="Setor (região de visita)">
        <select
          value={setorId}
          onChange={(e) => setSetorId(e.target.value)}
          className={inputCls}
        >
          <option value="">Sem setor</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </Campo>
      {!setorEscolhido ? (
        <Aviso tom="atencao" compacto>
          {setores.length === 0
            ? 'Nenhum setor criado ainda. Crie em Setores, no menu. Sem setor, nenhum vendedor verá este cliente.'
            : 'Sem setor, nenhum vendedor verá este cliente.'}
        </Aviso>
      ) : setorEscolhido.vendedores.length === 0 ? (
        <Aviso tom="atencao" compacto>
          Este setor ainda não tem vendedor. Adicione em Setores.
        </Aviso>
      ) : (
        <p className="-mt-1 text-xs text-slate-500">
          Quem visita:{' '}
          {setorEscolhido.vendedores.map((v) => v.nomeCompleto).join(', ')}
        </p>
      )}

      {cliente && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          Ativo
        </label>
      )}

      {erro && (
        <Aviso tom="erro" compacto>
          {erro}
        </Aviso>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
