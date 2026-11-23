import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';

const URL = `${API_URL}/pagamentos-manobristas`;

export type Situacao = 'PENDENTE' | 'PAGO' | 'ESTORNADO';
export type Forma = 'PIX' | 'DINHEIRO' | 'TRANSFERENCIA' | 'OUTRA';
export type TipoPix = 'CPF' | 'CNPJ' | 'TELEFONE' | 'EMAIL' | 'ALEATORIA';
export type Aba = 'diarias' | 'conferencia' | 'historico';

export interface FiltroPagamentos {
  inicio: string;
  fim: string;
  manobristaId: number;
  unidadeId: number;
  busca: string;
  situacao: Situacao | '';
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface Valores {
  aPagar: number;
  pago: number;
}
export interface Pendencia {
  manobristaId: number;
  manobrista: string;
  unidadeId: number;
  unidade: string;
  diarias: number;
  saldo: number;
}

export interface Resumo extends Valores {
  pendencias: Pendencia[];
  manobristasPendentes: number;
  pagamentos: number;
  unidades: (Valores & { unidade: string })[];
  meses: (Valores & { ano: number; mes: number })[];
}

export interface Candidato {
  fichaId: number;
  manobristaId: number;
  manobrista: string;
  unidade: string;
  unidadeId: number;
  data: string;
  turno: 'DIA' | 'NOITE';
  custo: number;
}

export interface Diaria extends Pick<Candidato, 'fichaId' | 'manobristaId' | 'manobrista' | 'unidade' | 'data' | 'custo'> {
  id: number;
  devido: number;
  pago: number;
  saldo: number;
  situacao: Situacao;
  pagamentoId: number | null;
  dataPagamento: string | null;
  revisao: number;
}

export interface Pagamento {
  id: number;
  manobrista: string;
  manobristaId: number;
  data: string;
  valor: number;
  forma: Forma;
  confirmador: string;
  confirmadoEm: string;
  estornadoEm: string | null;
  motivoEstorno: string | null;
  estornador: string | null;
  temComprovante: boolean;
  itens: { diariaId: number; fichaId: number; unidade: string; data: string; valor: number }[];
}

export interface Pix {
  tipo: TipoPix;
  chaveMascarada: string;
}

export interface Confirmacao {
  operacao: string;
  manobristaId: number;
  diarias: Pick<Diaria, 'id' | 'revisao'>[];
  data: string;
  forma: Forma;
  efetuado: true;
  valor: string;
}

@Injectable({ providedIn: 'root' })
export class PagamentosManobristasService {
  private readonly http = inject(HttpClient);

  resumo(filtro: FiltroPagamentos) {
    return firstValueFrom(this.http.get<Resumo>(`${URL}/resumo`, { params: this.params(filtro) }));
  }

  listar<T>(aba: Aba, filtro: FiltroPagamentos, pagina: number) {
    const params = this.params(filtro).set('pagina', pagina);
    return firstValueFrom(this.http.get<Pagina<T>>(`${URL}/${aba}`, { params }));
  }

  reconhecer(candidato: Candidato, valor: string) {
    return firstValueFrom(this.http.post<{ id: number }>(`${URL}/conferencia/${candidato.fichaId}`, {
      manobristaId: candidato.manobristaId, custoConferido: candidato.custo, valor,
      dataConferida: candidato.data, turnoConferido: candidato.turno, unidadeConferida: candidato.unidadeId,
    }));
  }

  confirmar(dados: Confirmacao, anexo: File | null) {
    const corpo = new FormData();
    corpo.set('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    if (anexo) corpo.set('comprovante', anexo);
    return firstValueFrom(this.http.post<Pagamento>(URL, corpo));
  }

  detalhar(id: number) {
    return firstValueFrom(this.http.get<Pagamento>(`${URL}/historico/${id}`));
  }

  estornar(id: number, motivo: string) {
    return firstValueFrom(this.http.post<Pagamento>(`${URL}/historico/${id}/estorno`, { motivo }));
  }

  comprovante(id: number) {
    return firstValueFrom(this.http.get(`${URL}/historico/${id}/comprovante`, { responseType: 'blob' }));
  }

  consultarPix(id: number) {
    return firstValueFrom(this.http.get<Pix>(`${URL}/pix/${id}`));
  }

  salvarPix(id: number, tipo: TipoPix, chave: string) {
    return firstValueFrom(this.http.put<Pix>(`${URL}/pix/${id}`, { tipo, chave }));
  }

  revelarPix(id: number) {
    return firstValueFrom(this.http.post<{ chave: string }>(`${URL}/pix/${id}/revelar`, {}));
  }

  private params(filtro: FiltroPagamentos): HttpParams {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtro)) {
      if (valor) params = params.set(chave, valor);
    }
    return params;
  }
}
