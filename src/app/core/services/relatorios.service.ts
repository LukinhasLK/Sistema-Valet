import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from './api';

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

@Injectable({ providedIn: 'root' })
export class RelatoriosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/relatorios/financeiro`;

  financeiro(filtro: FiltroRelatorio) {
    return this.http.get<RelatorioFinanceiro>(this.url, { params: { ...filtro } });
  }

  painel(filtro: FiltroRelatorio) {
    return this.http.get<ResumoPainel>(`${API_URL}/relatorios/painel`, { params: { ...filtro } });
  }

  divisao(filtro: { mes: number; ano: number; unidadeId: number }) {
    return this.http.get<DivisaoLucro>(`${API_URL}/relatorios/divisao-lucro`, { params: filtro });
  }

  pdf(filtro: FiltroRelatorio) {
    return this.http.get(`${this.url}/pdf`, { params: { ...filtro }, responseType: 'blob' });
  }

  carros(filtro: FiltroRelatorio, formato: 'pdf' | 'excel') {
    return this.http.get(`${API_URL}/relatorios/carros/${formato}`, { params: { ...filtro }, responseType: 'blob' });
  }

  excel(filtro: FiltroRelatorio) {
    return this.http.get(`${this.url}/excel`, { params: { ...filtro }, responseType: 'blob' });
  }
}
