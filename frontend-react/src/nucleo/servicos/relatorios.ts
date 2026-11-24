import { api } from './api';

export interface FiltroRelatorio {
  mes?: number;
  ano: number;
  unidadeId?: number;
}

export interface LinhaFinanceira {
  id: number;
  data: string;
  turno: 'dia' | 'noite';
  unidade: string;
  veiculos: number;
  dinheiro: number;
  cartao: number;
  pix: number;
  bruto: number;
  custos: number;
  liquido: number;
}

export interface RelatorioFinanceiro {
  resumo: {
    totalBruto: number;
    lucroFichas: number;
    despesasFixas: number;
    resultado: number;
    quantidadeFichas: number;
    totalCarros: number;
  };
  inicio: string;
  fim: string;
  unidade: string;
  custosFichas: number;
  linhas: LinhaFinanceira[];
}

export interface DivisaoLucro {
  resultado: number;
  lucroFichas: number;
  despesasFixas: number;
  quantidadeFichas: number;
  partes: { socioId: number; nome: string; percentual: number; valor: number }[];
}

export interface ResumoPainel {
  mes: RelatorioFinanceiro['resumo'];
  resultadoAnterior: number;
  brutoHoje: number;
  custosManobristas: number;
  despesasTotais: number;
  pagamentosPendentes: number;
  pagamentosConfirmados: number;
  fichasParaConferir: number;
  eventosProximos: number;
  porUnidade: { unidadeId: number; unidade: string; bruto: number; liquido: number }[];
}

const URL = '/relatorios/financeiro';
type P = Record<string, number | undefined>;

export const relatoriosServico = {
  financeiro: (filtro: FiltroRelatorio, sinal?: AbortSignal) => api.get<RelatorioFinanceiro>(URL, { ...filtro } as P, sinal),
  painel: (filtro: FiltroRelatorio, sinal?: AbortSignal) => api.get<ResumoPainel>('/relatorios/painel', { ...filtro } as P, sinal),
  divisao: (filtro: { mes: number; ano: number; unidadeId: number }, sinal?: AbortSignal) =>
    api.get<DivisaoLucro>('/relatorios/divisao-lucro', filtro, sinal),
  pdf: (filtro: FiltroRelatorio) => api.arquivo(`${URL}/pdf`, { ...filtro } as P),
  excel: (filtro: FiltroRelatorio) => api.arquivo(`${URL}/excel`, { ...filtro } as P),
  carros: (filtro: FiltroRelatorio, formato: 'pdf' | 'excel') => api.arquivo(`/relatorios/carros/${formato}`, { ...filtro } as P),
};
