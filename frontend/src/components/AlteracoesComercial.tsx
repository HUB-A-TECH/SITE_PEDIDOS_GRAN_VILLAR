import type { AlteracaoComercial, AlteracaoItem } from '../lib/pedidosApi';
import { brl, qtd, dataHoraBR } from '../lib/formatar';

/** Uma linha legível do que mudou num item. */
function descreverAlteracao(a: AlteracaoItem): string {
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
 * Caixa "O comercial alterou este pedido" / recado da administração: o que
 * mudou, recado para o vendedor e confirmação de leitura. Usada em Meus Pedidos,
 * no detalhe do Admin, no Perfil do Cliente e no topo da tela de Pedido.
 */
export function AlteracoesComercial({
  revisoes,
  destacarNovo = false,
  compacto = false,
}: {
  revisoes: AlteracaoComercial[];
  /** Etiqueta "Novo" na revisão mais recente (o vendedor ainda não tinha visto). */
  destacarNovo?: boolean;
  compacto?: boolean;
}) {
  if (revisoes.length === 0) return null;
  return (
    <div className={`${compacto ? 'mt-2' : 'mt-3'} space-y-2`}>
      {revisoes.map((r, i) => {
        const apenasRecado = r.alteracoes.length === 0 && Boolean(r.recado);
        const titulo = apenasRecado
          ? 'Recado da administração neste pedido'
          : 'O comercial alterou este pedido';
        return (
          <div
            key={r.id}
            className="rounded-lg border-l-4 border-brandYellow-400 bg-brandYellow-50 p-3 text-xs text-brandYellow-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                <span>{titulo}</span>
                {destacarNovo && i === revisoes.length - 1 && (
                  <span className="rounded-full bg-brandYellow-400 px-2 py-0.5 text-[10px] font-bold text-brandYellow-900">
                    Novo
                  </span>
                )}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  r.vistoPeloVendedorEm
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-brandYellow-400 text-brandYellow-800'
                }`}
              >
                {r.vistoPeloVendedorEm
                  ? `✓ Visto em ${dataHoraBR(r.vistoPeloVendedorEm)}`
                  : 'Não visto pelo vendedor'}
              </span>
            </div>
            <p className="mb-1 text-brandYellow-700">
              por {r.revisadoPor} em {dataHoraBR(r.revisadoEm)}
            </p>
            {r.alteracoes.length > 0 && (
              <ul className="space-y-0.5">
                {r.alteracoes.map((a) => (
                  <li key={a.produtoId}>• {descreverAlteracao(a)}</li>
                ))}
              </ul>
            )}
            {r.totalAntes !== r.totalDepois && (
              <p className="mt-1 font-semibold">
                Total: {brl(r.totalAntes)} → {brl(r.totalDepois)}
              </p>
            )}
            {r.recado && (
              <p className="mt-1.5 rounded bg-white/80 px-2 py-1.5 text-slate-800">
                <strong className="text-brandYellow-800">Recado:</strong> {r.recado}
              </p>
            )}
            {r.encerradoEm && (
              <p className="mt-1 text-[11px] text-slate-500">
                Aviso encerrado no próximo pedido em {dataHoraBR(r.encerradoEm)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
