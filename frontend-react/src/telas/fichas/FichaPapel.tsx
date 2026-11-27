import { dataBr, moeda, numero } from '../../compartilhado/formatos';
import { reduzido } from '../../compartilhado/movimento';
import { PerdidinhoTardio } from '../../compartilhado/perdidinho';
import { Ficha } from '../../nucleo/modelos';
import { usePresencaPerdidinho } from '../../nucleo/servicos/pendencias';
import './ficha-papel.scss';

interface Props {
  ficha: Ficha;
  unidade: string;
  /** true depois que o servidor confirmou o fechamento: o canhoto rasga e a ficha é carimbada. */
  fechada: boolean;
  /** false quando outro Perdidinho já está à vista (ex.: demo da apresentação). Padrão: true. */
  mascote?: boolean;
}

/**
 * A ficha de caixa do turno desenhada como o papel do bloco: número de série, pautas
 * e o canhoto picotado que se destaca quando a ficha é fechada.
 */
export function FichaPapel({ ficha, unidade, fechada, mascote = true }: Props) {
  const turno = ficha.turno === 'noite' ? 'Noite' : 'Dia';
  const serie = String(ficha.id).padStart(6, '0');
  // Com o mascote do carimbo à vista, o do menu vira silhueta (um Perdidinho com olhos por vez).
  usePresencaPerdidinho(fechada && mascote);

  return (
    <pf-ficha-papel>
      <div className={`papel${fechada ? ' papel--fechada' : ''}`}>
        <div className="papel__corpo">
          <header className="papel__topo">
            <div>
              <p className="papel__tipo">Ficha de caixa</p>
              <p className="papel__onde">{unidade} · {dataBr(ficha.data)} · Turno {turno}</p>
            </div>
            {fechada && mascote && (
              <div className="papel__mascote" data-testid="papel-mascote" aria-hidden="true">
                <PerdidinhoTardio decorativo tamanho={40} humor="comemorando" falando={false} passo="ficha-fechada"
                  lado="centro" reduzirMovimento={reduzido()} />
              </div>
            )}
            <p className="papel__serie" aria-label={`Ficha número ${ficha.id}`}>Nº {serie}</p>
          </header>

          <dl className="papel__linhas">
            <div><dt>Tickets</dt><dd>#{ficha.fichaInicio} a #{ficha.fichaFim}</dd></div>
            <div><dt>Carros</dt><dd>{numero(ficha.totalCarros)}</dd></div>
            <div><dt>Faturamento</dt><dd>{moeda(ficha.totalBruto)}</dd></div>
            <div className="papel__liquido"><dt>Líquido do turno</dt><dd>{moeda(ficha.totalLiquido)}</dd></div>
          </dl>

          <p className="papel__carimbo" aria-hidden={!fechada}>Fechada</p>
        </div>

        <div className="papel__picote" aria-hidden="true" />

        <div className="papel__canhoto" aria-hidden="true">
          <span className="papel__serie papel__serie--canhoto">Nº {serie}</span>
          <span>{dataBr(ficha.data)} · {turno}</span>
          <strong>{moeda(ficha.totalLiquido)}</strong>
        </div>
      </div>
    </pf-ficha-papel>
  );
}
