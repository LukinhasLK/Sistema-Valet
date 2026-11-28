import { api } from './api';

export interface UnidadeSocio {
  unidadeId: number;
  nome: string;
  percentual: number;
  /** Resultado da unidade no mês (lucro das fichas − despesas fixas). */
  resultado: number;
  /** Parte do sócio; null quando o rateio da unidade não soma 100%. */
  valor: number | null;
  fichas: number;
}

export interface MesSocio {
  mes: number;
  /** null = mês que ainda não começou. */
  valor: number | null;
}

export interface Sociedade {
  socioId: number;
  nome: string;
  mes: number;
  ano: number;
  mesEmAndamento: boolean;
  totalMes: number;
  rateioIncompleto: boolean;
  unidades: UnidadeSocio[];
  meses: MesSocio[];
  /** Fichas do mês ainda não fechadas nas unidades do sócio (ficam fora da conta). */
  fichasAbertas: number;
}

export const sociedadeServico = {
  /** `socioId` só é usado pelo proprietário; o sócio sempre recebe a própria sociedade. */
  consultar: (filtro: { mes: number; ano: number; socioId?: number }, sinal?: AbortSignal) =>
    api.get<Sociedade>('/sociedade', filtro, sinal),
};

/** Soma do ano até agora (meses futuros ficam de fora). */
export function acumuladoNoAno(meses: MesSocio[]): number {
  return Math.round(meses.reduce((soma, m) => soma + (m.valor ?? 0), 0) * 100) / 100;
}
