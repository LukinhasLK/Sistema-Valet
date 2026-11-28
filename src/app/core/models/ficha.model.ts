export type SituacaoFicha = 'EM_EDICAO' | 'PRONTA' | 'FECHADA' | 'CANCELADA';
export type AcaoFicha = 'ENVIAR' | 'FECHAR' | 'DEVOLVER' | 'REABRIR';

export interface RegistroFicha {
  acao: string;
  ator: string;
  justificativa: string | null;
  registradoEm: string;
}

export type Turno = 'dia' | 'noite';

export const MODALIDADES_CUSTO = {
  DIARIA_FIXA: 'Diária fixa',
  VALOR_FIXO_POR_MANOBRA: 'Por manobra',
  PORCENTAGEM: 'Por percentual',
} as const;

export type ModalidadeCusto = keyof typeof MODALIDADES_CUSTO;

export interface ManobristaFicha {
  manobristaId: number;
  diaria: number;
  modalidade?: ModalidadeCusto;
}

export interface DespesaAdicional {
  descricao: string;
  valor: number;
}

export interface Ficha {
  id: number;
  data: string;
  unidadeId: number;
  turno: Turno;
  fichaInicio: number;
  fichaFim: number;
  fichasCanceladas: number;
  totalCarros: number;
  valorDinheiro: number;
  valorCartao: number;
  valorPix?: number;
  valorInicialCaixa?: number | null;
  valorFinalCaixa?: number | null;
  observacoes?: string | null;
  situacao?: SituacaoFicha;
  responsavelId?: number | null;
  fechadoPor?: number | null;
  fechadoEm?: string | null;
  taxaMaquininha: number;
  manobristas: ManobristaFicha[];
  despesasAdicionais: DespesaAdicional[];
  totalBruto: number;
  totalLiquido: number;
}
