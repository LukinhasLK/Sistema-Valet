import { SituacaoFicha } from '../nucleo/modelos';
import './situacao.scss';

/** Situações exibidas no sistema. As da ficha vêm da API; as demais são de pagamentos. */
export type TipoSituacao = SituacaoFicha | 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'ATIVO' | 'INATIVO';

const INFO: Record<TipoSituacao, { rotulo: string; tom: string }> = {
  EM_EDICAO: { rotulo: 'Em edição', tom: 'edicao' },
  PRONTA: { rotulo: 'Pronta para conferência', tom: 'pronta' },
  FECHADA: { rotulo: 'Fechada', tom: 'fechada' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'cancelada' },
  PENDENTE: { rotulo: 'Pendente', tom: 'pronta' },
  PARCIAL: { rotulo: 'Parcial', tom: 'pronta' },
  PAGO: { rotulo: 'Pago', tom: 'fechada' },
  ATIVO: { rotulo: 'Ativo', tom: 'fechada' },
  INATIVO: { rotulo: 'Inativo', tom: 'cancelada' },
};

/** Ordem de trabalho: o que precisa de ação aparece primeiro. */
export const ORDEM_SITUACAO_FICHA: SituacaoFicha[] = ['PRONTA', 'EM_EDICAO', 'FECHADA', 'CANCELADA'];

export const rotuloSituacao = (tipo: TipoSituacao | undefined | null) => INFO[tipo ?? 'EM_EDICAO'].rotulo;

/**
 * Ícone de progresso: tracejado (em edição), metade (aguardando conferência),
 * completo com visto (fechada) e riscado (cancelada).
 */
export function IconeSituacao({ tipo, tamanho = 14 }: { tipo: TipoSituacao; tamanho?: number }) {
  const tom = INFO[tipo].tom;
  return (
    <svg className={`pf-sit-icone pf-sit-icone--${tom}`} width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {tom === 'edicao' && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2.2" />}
      {tom === 'pronta' && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.2a3.8 3.8 0 0 1 0 7.6z" fill="currentColor" />
        </>
      )}
      {tom === 'fechada' && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.2 8.2 1.9 1.9 3.8-4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {tom === 'cancelada' && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

interface Props {
  tipo: TipoSituacao | undefined | null;
  /** `etiqueta`: pílula com fundo. `texto`: só ícone e rótulo (tabelas densas). */
  estilo?: 'etiqueta' | 'texto';
  rotulo?: string;
}

export function Situacao({ tipo, estilo = 'etiqueta', rotulo }: Props) {
  const t = tipo ?? 'EM_EDICAO';
  return (
    <span className={`pf-situacao pf-situacao--${estilo} pf-situacao--${INFO[t].tom}`}>
      <IconeSituacao tipo={t} />
      <span>{rotulo ?? INFO[t].rotulo}</span>
    </span>
  );
}
