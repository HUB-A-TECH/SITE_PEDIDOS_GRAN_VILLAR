import type { AlteracaoComercial, AlteracaoItem } from '../lib/pedidosApi';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Uma linha legível do que mudou num item. */
export function descreverAlteracao(a: AlteracaoItem): string {
  if (a.removido) {
    return `${a.nome}: removido do pedido (era ${qtd(a.quantidadeAntes)} ${a.unidadeMedida})`;
  }
  const partes: string[] = [];
  if (a.quantidadeAntes !== a.quantidadeDepois) {
    partes.push(`quantidade ${qtd(a.quantidadeAntes)} → ${qtd(a.quantidadeDepois)} ${a.unidadeMedida}`);
  }
  if (a.precoAntes !== a.precoDepois) {
    partes.push(`preço ${brl(a.precoAntes)} → ${brl(a.precoDepois)}`);
  }
  return `${a.nome}: ${partes.join('; ')}`;
}

/**
 * Caixa "O comercial alterou este pedido": o que mudou, quem mudou e quando.
 * Usada no card do vendedor (Meus Pedidos) e no histórico do admin.
 */
export function AlteracoesComercial({
  revisoes,
  destacarNovo = false,
}: {
  revisoes: AlteracaoComercial[];
  /** Etiqueta "Novo" na revisão mais recente (o vendedor ainda não tinha visto). */
  destacarNovo?: boolean;
}) {
  if (revisoes.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {revisoes.map((r, i) => (
        <div
          key={r.id}
          className="rounded-lg border-l-4 border-brandYellow-400 bg-brandYellow-50 p-3 text-xs text-brandYellow-800"
        >
          <p className="flex items-center gap-2 font-semibold">
            O comercial alterou este pedido
            {destacarNovo && i === revisoes.length - 1 && (
              <span className="rounded-full bg-brandYellow-400 px-2 py-0.5 text-[10px] font-bold text-brandYellow-900">
                Novo
              </span>
            )}
          </p>
          <p className="mb-1 text-brandYellow-700">
            por {r.revisadoPor} em {dataHoraBR(r.revisadoEm)}
          </p>
          <ul className="space-y-0.5">
            {r.alteracoes.map((a) => (
              <li key={a.produtoId}>• {descreverAlteracao(a)}</li>
            ))}
          </ul>
          {r.totalAntes !== r.totalDepois && (
            <p className="mt-1 font-semibold">
              Total: {brl(r.totalAntes)} → {brl(r.totalDepois)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
