import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { useDialogo } from '../../context/DialogoContext';
import * as clientesApi from '../../lib/clientesApi';
import * as setoresApi from '../../lib/setoresApi';
import { CORES_INICIAIS, paleta } from '../../lib/coresSetor';
import type { Local, Setor } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

/**
 * Setores = regiões de visita. O admin cria o setor e coloca nele os vendedores
 * e os clientes daquela região; o vendedor vê os clientes dos seus setores.
 */
export function AdminSetoresPage() {
  const navigate = useNavigate();
  const { pedirTexto, avisar } = useDialogo();
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState('');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [semSetor, setSemSetor] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    clientesApi.listarLocais().then((ls) => {
      setLocais(ls);
      if (ls.length > 0) setLocalId(ls[0].id);
      else setCarregando(false);
    });
  }, []);

  useEffect(() => {
    if (!localId) return;
    setCarregando(true);
    Promise.all([setoresApi.listar(localId), clientesApi.adminListar(localId)])
      .then(([ss, clientes]) => {
        setSetores(ss);
        // Clientes ativos sem setor ficam invisíveis para todos os vendedores.
        setSemSetor(clientes.filter((c) => c.ativo && !c.setor).length);
      })
      .finally(() => setCarregando(false));
  }, [localId]);

  async function novoSetor() {
    const nome = await pedirTexto({
      titulo: 'Novo Setor',
      mensagem: 'Depois de criar, você escolhe os vendedores e os clientes dele.',
      rotulo: 'Nome do setor',
      placeholder: 'Ex.: Zona Norte',
    });
    if (!nome) return;
    try {
      // Cor inicial segue o rodízio (vermelho, amarelo, verde, azul); o admin
      // troca na tela do setor.
      const cor = CORES_INICIAIS[setores.length % CORES_INICIAIS.length];
      const setor = await setoresApi.criar({ nome, localId, cor });
      navigate(`/admin/setores/${setor.id}`);
    } catch (e) {
      await avisar({
        titulo: 'Não foi possível criar',
        tom: 'erro',
        mensagem:
          axios.isAxiosError(e) && e.response?.data?.mensagem
            ? e.response.data.mensagem
            : 'Tente novamente.',
      });
    }
  }

  /** Troca o setor de lugar com o vizinho (cima = -1, baixo = +1). */
  async function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= setores.length) return;
    const nova = [...setores];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setSetores(nova);
    try {
      setSetores(await setoresApi.reordenar(localId, nova.map((s) => s.id)));
    } catch {
      setSetores(setores);
      await avisar({ titulo: 'Não foi possível mudar a ordem', tom: 'erro', mensagem: 'Tente novamente.' });
    }
  }

  return (
    <AppLayout
      titulo="Setores"
      voltarPara="/"
      acao={
        <button
          onClick={novoSetor}
          disabled={!localId}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium hover:bg-brand-500 disabled:opacity-50"
        >
          + Novo
        </button>
      }
    >
      {/* Só mostra a escolha de filial quando existe mais de uma. */}
      {locais.length > 1 && (
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
      )}

      <Aviso className="mb-4">
        Cada setor é uma região de visitas, com uma cor. No Novo Pedido o vendedor
        vê os cartões dos seus setores nesta ordem — use as setas para mudar.
      </Aviso>

      {!carregando && semSetor > 0 && (
        <Aviso tom="atencao" className="mb-4">
          {semSetor === 1
            ? '1 cliente está sem setor e não aparece para nenhum vendedor.'
            : `${semSetor} clientes estão sem setor e não aparecem para nenhum vendedor.`}
        </Aviso>
      )}

      {carregando ? (
        <p className="text-center text-slate-500">Carregando…</p>
      ) : setores.length === 0 ? (
        <p className="text-center text-slate-500">
          Nenhum setor ainda. Toque em "+ Novo" para criar o primeiro.
        </p>
      ) : (
        <ul className="sem-grade space-y-2">
          {setores.map((s, i) => {
            const semVendedor = s.vendedores.length === 0;
            const p = paleta(s.cor);
            return (
              <li
                key={s.id}
                className={`flex items-stretch gap-2 rounded-xl border-l-8 bg-white p-4 shadow-sm ${p.borda}`}
              >
                <button
                  onClick={() => navigate(`/admin/setores/${s.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-semibold text-slate-800">
                    {i + 1}. {s.nome}{' '}
                    <span className="text-xs font-normal text-slate-500">· {p.nome}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.totalClientes === 1 ? '1 cliente' : `${s.totalClientes} clientes`}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      semVendedor ? 'font-medium text-brandYellow-700' : 'text-slate-500'
                    }`}
                  >
                    {semVendedor
                      ? 'Sem vendedor: ninguém visita estes clientes'
                      : `Vendedor: ${s.vendedores.map((v) => v.nomeCompleto).join(', ')}`}
                  </p>
                </button>
                <div className="flex flex-col justify-center gap-1">
                  <button
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${s.nome}`}
                    className="rounded border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => mover(i, 1)}
                    disabled={i === setores.length - 1}
                    aria-label={`Descer ${s.nome}`}
                    className="rounded border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppLayout>
  );
}
