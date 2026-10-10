import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Modal } from '../components/Modal';
import { Aviso, type TomAviso } from '../components/Aviso';

/**
 * Janelas de confirmação e aviso do próprio sistema, no lugar de `confirm()`,
 * `alert()` e `prompt()` do navegador.
 *
 * As do navegador não podem ser estilizadas, aparecem com "localhost diz:" e
 * usam o visual do sistema operacional — destoando do resto da tela. Estas
 * usam o mesmo Modal e as mesmas cores de Aviso do restante do sistema.
 *
 * As três funções devolvem Promise, então o uso fica parecido com o de antes:
 *
 *   if (!(await confirmar({ titulo: '…', mensagem: '…' }))) return;
 */

interface OpcoesConfirmar {
  titulo: string;
  mensagem: ReactNode;
  /** Cor do aviso dentro da janela. 'atencao' para ações com consequência. */
  tom?: TomAviso;
  textoConfirmar?: string;
  /** Botão vermelho, para ações destrutivas (cancelar, descartar). */
  destrutivo?: boolean;
}

interface OpcoesAvisar {
  titulo: string;
  mensagem: ReactNode;
  tom?: TomAviso;
}

interface OpcoesTexto {
  titulo: string;
  mensagem?: ReactNode;
  rotulo: string;
  /** Sem valor digitado, resolve com string vazia em vez de cancelar. */
  opcional?: boolean;
  tipo?: 'text' | 'password';
  placeholder?: string;
  /** Texto que já vem no campo (ex.: o nome atual, ao renomear). */
  valorInicial?: string;
  /** Devolve a mensagem de erro, ou null se o valor estiver bom. */
  validar?: (valor: string) => string | null;
}

interface Dialogo {
  confirmar: (o: OpcoesConfirmar) => Promise<boolean>;
  avisar: (o: OpcoesAvisar) => Promise<void>;
  pedirTexto: (o: OpcoesTexto) => Promise<string | null>;
}

const DialogoContext = createContext<Dialogo | null>(null);

type Estado =
  | { tipo: 'fechado' }
  | { tipo: 'confirmar'; opcoes: OpcoesConfirmar }
  | { tipo: 'avisar'; opcoes: OpcoesAvisar }
  | { tipo: 'texto'; opcoes: OpcoesTexto };

export function DialogoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'fechado' });
  // Guarda o `resolve` da Promise aberta, para responder quando o usuário clicar.
  const resolver = useRef<((valor: unknown) => void) | null>(null);

  const responder = useCallback((valor: unknown) => {
    setEstado({ tipo: 'fechado' });
    resolver.current?.(valor);
    resolver.current = null;
  }, []);

  const api = useMemo<Dialogo>(
    () => ({
      confirmar: (opcoes) =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve as (v: unknown) => void;
          setEstado({ tipo: 'confirmar', opcoes });
        }),
      avisar: (opcoes) =>
        new Promise<void>((resolve) => {
          resolver.current = resolve as (v: unknown) => void;
          setEstado({ tipo: 'avisar', opcoes });
        }),
      pedirTexto: (opcoes) =>
        new Promise<string | null>((resolve) => {
          resolver.current = resolve as (v: unknown) => void;
          setEstado({ tipo: 'texto', opcoes });
        }),
    }),
    [],
  );

  return (
    <DialogoContext.Provider value={api}>
      {children}

      <Modal
        titulo={estado.tipo === 'fechado' ? '' : estado.opcoes.titulo}
        aberto={estado.tipo !== 'fechado'}
        // Fechar pelo × equivale a não confirmar / cancelar.
        onFechar={() => responder(estado.tipo === 'confirmar' ? false : null)}
      >
        {estado.tipo === 'confirmar' && (
          <ConteudoConfirmar opcoes={estado.opcoes} onResponder={responder} />
        )}
        {estado.tipo === 'avisar' && (
          <ConteudoAvisar opcoes={estado.opcoes} onFechar={() => responder(undefined)} />
        )}
        {estado.tipo === 'texto' && (
          <ConteudoTexto opcoes={estado.opcoes} onResponder={responder} />
        )}
      </Modal>
    </DialogoContext.Provider>
  );
}

export function useDialogo(): Dialogo {
  const ctx = useContext(DialogoContext);
  if (!ctx) throw new Error('useDialogo precisa estar dentro de DialogoProvider');
  return ctx;
}

// ---- Conteúdos ----

const BOTAO_BASE = 'w-full rounded-lg py-2.5 text-sm font-medium';
const BOTAO_NEUTRO = `${BOTAO_BASE} border border-slate-300 text-slate-700 hover:bg-slate-100`;
const BOTAO_VERDE = `${BOTAO_BASE} bg-brand-600 text-white hover:bg-brand-500`;
const BOTAO_VERMELHO = `${BOTAO_BASE} bg-red-600 text-white hover:bg-red-500`;

function ConteudoConfirmar({
  opcoes,
  onResponder,
}: {
  opcoes: OpcoesConfirmar;
  onResponder: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Aviso tom={opcoes.tom ?? 'atencao'}>{opcoes.mensagem}</Aviso>
      <div className="flex gap-2">
        <button onClick={() => onResponder(false)} className={BOTAO_NEUTRO}>
          Voltar
        </button>
        <button
          autoFocus
          onClick={() => onResponder(true)}
          className={opcoes.destrutivo ? BOTAO_VERMELHO : BOTAO_VERDE}
        >
          {opcoes.textoConfirmar ?? 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

function ConteudoAvisar({
  opcoes,
  onFechar,
}: {
  opcoes: OpcoesAvisar;
  onFechar: () => void;
}) {
  return (
    <div className="space-y-4">
      <Aviso tom={opcoes.tom ?? 'info'}>{opcoes.mensagem}</Aviso>
      <button autoFocus onClick={onFechar} className={BOTAO_VERDE}>
        Entendi
      </button>
    </div>
  );
}

function ConteudoTexto({
  opcoes,
  onResponder,
}: {
  opcoes: OpcoesTexto;
  onResponder: (v: string | null) => void;
}) {
  const [valor, setValor] = useState(opcoes.valorInicial ?? '');
  const [erro, setErro] = useState('');

  function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = valor.trim();
    if (!limpo && !opcoes.opcional) {
      setErro('Preencha este campo.');
      return;
    }
    const problema = opcoes.validar?.(limpo);
    if (problema) {
      setErro(problema);
      return;
    }
    onResponder(limpo);
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {opcoes.mensagem && <Aviso tom="info">{opcoes.mensagem}</Aviso>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {opcoes.rotulo}
          {opcoes.opcional && (
            <span className="font-normal text-slate-400"> (opcional)</span>
          )}
        </span>
        <input
          autoFocus
          type={opcoes.tipo ?? 'text'}
          value={valor}
          placeholder={opcoes.placeholder}
          onChange={(e) => {
            setValor(e.target.value);
            if (erro) setErro('');
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>

      {erro && (
        <Aviso tom="erro" compacto>
          {erro}
        </Aviso>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onResponder(null)}
          className={BOTAO_NEUTRO}
        >
          Cancelar
        </button>
        <button type="submit" className={BOTAO_VERDE}>
          Confirmar
        </button>
      </div>
    </form>
  );
}
