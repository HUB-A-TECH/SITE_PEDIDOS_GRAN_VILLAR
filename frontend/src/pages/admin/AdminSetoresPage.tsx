import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Aviso } from '../../components/Aviso';
import { useDialogo } from '../../context/DialogoContext';
import * as clientesApi from '../../lib/clientesApi';
import * as setoresApi from '../../lib/setoresApi';
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
      const setor = await setoresApi.criar({ nome, localId });
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
        Cada setor é uma região de visitas. O vendedor vê os clientes de todos os
        setores em que está.
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
        <ul className="space-y-2">
          {setores.map((s) => {
            const semVendedor = s.vendedores.length === 0;
            return (
              <li
                key={s.id}
                className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${
                  semVendedor ? 'border-brandYellow-400' : 'border-brand-500'
                }`}
              >
                <button
                  onClick={() => navigate(`/admin/setores/${s.id}`)}
                  className="w-full text-left"
                >
                  <p className="font-semibold text-slate-800">{s.nome}</p>
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
              </li>
            );
          })}
        </ul>
      )}
    </AppLayout>
  );
}
