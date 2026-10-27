import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { useAuth } from '../../context/AuthContext';
import * as clientesApi from '../../lib/clientesApi';
import * as pedidosApi from '../../lib/pedidosApi';
import type { AlteracaoMix, PerfilCliente } from '../../lib/clientesApi';
import { iniciais, linkMapa, linkTelefone, linkWhatsApp } from '../../lib/contato';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** "hoje", "ontem" ou "há N dias", contando dias do calendário. */
function haQuantoTempo(iso: string): string {
  const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDoDia(new Date()) - inicioDoDia(new Date(iso))) / UM_DIA_MS);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

const formatarQtd = (q: number, unidade: string) =>
  q.toLocaleString('pt-BR', { maximumFractionDigits: unidade === 'UND' ? 0 : 2 });

export function PerfilClientePage() {
  const { clienteId = '' } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const ehVendedor = usuario?.type === 'VENDEDOR';
  const [perfil, setPerfil] = useState<PerfilCliente | null>(null);
  const [erro, setErro] = useState('');
  const [abrindoPedido, setAbrindoPedido] = useState(false);
  const [mudancasMix, setMudancasMix] = useState<AlteracaoMix[]>([]);

  useEffect(() => {
    setPerfil(null);
    setErro('');
    clientesApi
      .perfil(clienteId)
      .then(setPerfil)
      .catch((e) =>
        setErro(
          axios.isAxiosError(e) && e.response?.data?.mensagem
            ? e.response.data.mensagem
            : 'Não foi possível abrir o perfil.',
        ),
      );
    clientesApi.historicoMix(clienteId).then(setMudancasMix).catch(() => setMudancasMix([]));
  }, [clienteId]);

  const voltarPara = ehVendedor ? '/meus-clientes' : '/admin/clientes';

  if (!perfil) {
    return (
      <AppLayout titulo="Perfil do Cliente" voltarPara={voltarPara} voltarUsaHistorico>
        {erro ? (
          <Aviso tom="erro">{erro}</Aviso>
        ) : (
          <p className="text-center text-slate-500">Carregando…</p>
        )}
      </AppLayout>
    );
  }

  const { cliente: c, resumo: r } = perfil;

  async function fazerPedido() {
    if (perfil?.pedidoSalvoId) {
      navigate(`/pedido/${perfil.pedidoSalvoId}`);
      return;
    }
    setAbrindoPedido(true);
    try {
      const pedido = await pedidosApi.criar(c.id);
      navigate(`/pedido/${pedido.id}`);
    } finally {
      setAbrindoPedido(false);
    }
  }

  // Contato preferido: o comprador; sem ele, o telefone da loja.
  const telefonePrincipal = c.telefoneComprador || c.telefone;
  const ruaENumero = [c.logradouro, c.numero].filter(Boolean).join(', ');
  const cidadeUf = [c.cidade, c.estado].filter(Boolean).join(' - ');
  const enderecoLinhas = [
    [ruaENumero, c.complemento].filter(Boolean).join(' · '),
    [c.bairro, cidadeUf].filter(Boolean).join(', '),
    c.cep ? `CEP ${c.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : '',
  ].filter(Boolean);
  // Só monta o mapa com rua ou cidade (só o CEP/bairro acharia o lugar errado).
  const mapa = ruaENumero || c.cidade ? linkMapa([ruaENumero, c.bairro, cidadeUf, c.cep]) : null;

  // Botões que dependem do cadastro: só aparecem quando há o dado.
  const atalhos = [
    telefonePrincipal && linkWhatsApp(telefonePrincipal) && {
      href: linkWhatsApp(telefonePrincipal)!,
      novaAba: true,
      icone: 'conversa' as const,
      texto: 'WhatsApp',
    },
    telefonePrincipal && linkTelefone(telefonePrincipal) && {
      href: linkTelefone(telefonePrincipal)!,
      novaAba: false,
      icone: 'telefone' as const,
      texto: 'Ligar',
    },
    mapa && { href: mapa, novaAba: true, icone: 'mapa' as const, texto: 'Ver no mapa' },
  ].filter((a): a is Exclude<typeof a, '' | null | false | undefined> => Boolean(a));

  return (
    <AppLayout titulo="Perfil do Cliente" voltarPara={voltarPara} voltarUsaHistorico>
      {/* ---- Cabeçalho ---- */}
      <div className="mb-3 rounded-xl bg-white p-5 text-center shadow-sm">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-xl font-bold text-brand-700">
          {iniciais(c.nome)}
        </div>
        <p className="text-lg font-bold text-slate-800">{c.nome}</p>
        <p className="text-sm text-slate-500">
          {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
          {c.codigo}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {c.setor ? c.setor.nome : 'Sem setor'}
          </span>
          {!c.ativo && (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
              inativo
            </span>
          )}
        </div>
      </div>

      {/* ---- Ações rápidas ---- */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {ehVendedor && c.ativo && (
          <button
            onClick={fazerPedido}
            disabled={abrindoPedido}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
          >
            <Icone tipo="carrinho" />
            {abrindoPedido
              ? 'Abrindo…'
              : perfil.pedidoSalvoId
                ? 'Continuar pedido salvo'
                : 'Fazer pedido'}
          </button>
        )}
        {atalhos.map((a, i) => (
          <a
            key={a.texto}
            href={a.href}
            {...(a.novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            // Número ímpar de botões: o último ocupa a linha inteira.
            className={`flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 ${
              i === atalhos.length - 1 && atalhos.length % 2 === 1 ? 'col-span-2' : ''
            }`}
          >
            <Icone tipo={a.icone} /> {a.texto}
          </a>
        ))}
      </div>

      {/* ---- Resumo de compras ---- */}
      <Secao titulo="Compras">
        {r.totalPedidos === 0 ? (
          <p className="text-sm text-slate-500">Ainda não tem pedidos enviados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Numero
              rotulo="Última compra"
              valor={r.ultimaCompra ? haQuantoTempo(r.ultimaCompra) : '—'}
              detalhe={r.ultimaCompra ? dataBR(r.ultimaCompra) : undefined}
            />
            <Numero
              rotulo="Compra a cada"
              valor={r.intervaloMedioDias !== null ? `~${r.intervaloMedioDias} dias` : '—'}
              detalhe={r.intervaloMedioDias === null ? 'poucos pedidos ainda' : 'nos últimos 12 meses'}
            />
            <Numero rotulo="Pedidos (12 meses)" valor={String(r.pedidos12Meses)} detalhe={`${r.totalPedidos} no total`} />
            <Numero
              rotulo="Média por pedido"
              valor={r.ticketMedio !== null ? brl(r.ticketMedio) : '—'}
            />
          </div>
        )}
      </Secao>

      {r.maisComprados.length > 0 && (
        <Secao titulo="Mais comprados" subtitulo="últimos 12 meses">
          <ul className="divide-y divide-slate-100">
            {r.maisComprados.map((m) => (
              <li key={m.produtoId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{m.nome}</p>
                  <p className="text-xs text-slate-400">
                    em {m.pedidos} de {r.pedidos12Meses} pedidos
                  </p>
                </div>
                <p className="shrink-0 text-sm text-slate-600">
                  ~{formatarQtd(m.mediaPorPedido, m.unidadeMedida)} {m.unidadeMedida}
                  <span className="block text-right text-xs text-slate-400">por pedido</span>
                </p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {/* ---- Contato e endereço ---- */}
      <Secao titulo="Contato e endereço">
        <dl className="space-y-2 text-sm">
          {(c.nomeComprador || c.telefoneComprador) && (
            <Linha rotulo="Comprador">
              {c.nomeComprador}
              {c.nomeComprador && c.telefoneComprador ? ' · ' : ''}
              {c.telefoneComprador && <Telefone numero={c.telefoneComprador} />}
            </Linha>
          )}
          {c.telefone && (
            <Linha rotulo="Telefone da loja">
              <Telefone numero={c.telefone} />
            </Linha>
          )}
          {c.email && (
            <Linha rotulo="E-mail">
              <a href={`mailto:${c.email}`} className="break-all text-brand-700 underline">
                {c.email}
              </a>
            </Linha>
          )}
          {enderecoLinhas.length > 0 && (
            <Linha rotulo="Endereço">
              {enderecoLinhas.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </Linha>
          )}
          {c.cnpj && <Linha rotulo="CNPJ">{c.cnpj}</Linha>}
          {!c.nomeComprador && !c.telefoneComprador && !c.telefone && !c.email && enderecoLinhas.length === 0 && (
            <p className="text-slate-500">Sem contato ou endereço cadastrado.</p>
          )}
        </dl>
      </Secao>

      {/* ---- Últimos pedidos ---- */}
      {perfil.ultimosPedidos.length > 0 && (
        <Secao titulo="Últimos pedidos">
          <ul className="divide-y divide-slate-100">
            {perfil.ultimosPedidos.map((p) => (
              <li key={p.pedidoId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-800">{p.numeroPedido ?? 'Pedido'}</p>
                  <p className="text-xs text-slate-400">
                    {dataBR(p.data)} · {p.itensCount === 1 ? '1 item' : `${p.itensCount} itens`}
                  </p>
                  {p.alteradoPeloComercial && (
                    <span className="mt-0.5 inline-block rounded-md bg-brandYellow-50 px-1.5 py-0.5 text-[11px] font-medium text-brandYellow-800">
                      alterado pelo comercial
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-800">{brl(p.total)}</p>
              </li>
            ))}
          </ul>
          <Link
            to={`/clientes/${c.id}/historico`}
            className="mt-2 block rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Ver todos os pedidos e itens →
          </Link>
        </Secao>
      )}

      {/* ---- Mudanças no mix ---- */}
      {mudancasMix.length > 0 && <HistoricoMix alteracoes={mudancasMix} />}
    </AppLayout>
  );
}

const TEXTO_ACAO: Record<AlteracaoMix['acao'], { texto: string; cor: string }> = {
  ADICIONADO_AO_MIX: { texto: 'Colocado no mix', cor: 'text-brand-700' },
  REMOVIDO_DO_MIX: { texto: 'Tirado do mix', cor: 'text-red-600' },
  ADICIONADO_NO_PEDIDO: { texto: 'Pedido só uma vez (fora do mix)', cor: 'text-brandYellow-800' },
};

/** Quem pôs ou tirou produtos do mix, e os pedidos avulsos fora do mix. */
function HistoricoMix({ alteracoes }: { alteracoes: AlteracaoMix[] }) {
  const [tudo, setTudo] = useState(false);
  const mostrar = tudo ? alteracoes : alteracoes.slice(0, 5);
  return (
    <Secao titulo="Mudanças no mix" subtitulo="mais recentes primeiro">
      <ul className="divide-y divide-slate-100">
        {mostrar.map((a) => (
          <li key={a.id} className="py-2 text-sm">
            <p className="text-slate-800">{a.produto}</p>
            <p className="text-xs text-slate-500">
              <span className={`font-medium ${TEXTO_ACAO[a.acao].cor}`}>{TEXTO_ACAO[a.acao].texto}</span>
              {' · '}
              {dataBR(a.data)}
              {a.quem ? ` · ${a.quem}` : ''}
            </p>
          </li>
        ))}
      </ul>
      {alteracoes.length > 5 && (
        <button
          onClick={() => setTudo((t) => !t)}
          className="mt-2 block w-full rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          {tudo ? 'Mostrar menos' : `Ver todas (${alteracoes.length})`}
        </button>
      )}
    </Secao>
  );
}

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 flex items-baseline justify-between text-sm font-bold text-slate-700">
        {titulo}
        {subtitulo && <span className="text-xs font-normal text-slate-400">{subtitulo}</span>}
      </h2>
      {children}
    </section>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-bold text-slate-800">{valor}</p>
      {detalhe && <p className="text-xs text-slate-400">{detalhe}</p>}
    </div>
  );
}

/** Telefone tocável (abre o discador); se for curto demais, só o texto. */
function Telefone({ numero }: { numero: string }) {
  const href = linkTelefone(numero);
  return href ? (
    <a href={href} className="text-brand-700 underline">
      {numero}
    </a>
  ) : (
    <>{numero}</>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{rotulo}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}

/** Ícones em SVG (e não emoji), como no restante do sistema. */
function Icone({ tipo }: { tipo: 'carrinho' | 'conversa' | 'telefone' | 'mapa' }) {
  const comum = {
    className: 'h-4 w-4 shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (tipo === 'carrinho') {
    return (
      <svg {...comum}>
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 7H6" />
      </svg>
    );
  }
  if (tipo === 'conversa') {
    return (
      <svg {...comum}>
        <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12Z" />
      </svg>
    );
  }
  if (tipo === 'telefone') {
    return (
      <svg {...comum}>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
