import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';

export type SituacaoEvento = 'PLANEJADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO';
export type SituacaoEscala = 'PLANEJADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA';

export interface Evento {
  id?: number;
  unidadeId: number | null;
  nome: string;
  contratante: string;
  local: string;
  inicio: string;
  fim: string;
  veiculosPrevistos: number;
  capacidade: number;
  equipePrevista: number;
  responsavel: string;
  valorContratado: number | null;
  despesasPrevistas: number | null;
  situacao: SituacaoEvento;
  observacoes: string;
}

export interface Escala {
  id?: number;
  unidadeId: number | null;
  eventoId: number | null;
  inicio: string;
  fim: string;
  responsavel: string;
  situacao: SituacaoEscala;
  observacoes: string;
  manobristaIds: number[];
}

export interface AlteracaoEscala {
  id: number;
  ator: string;
  registradoEm: string;
  situacao: SituacaoEscala;
  equipe: string;
}

export interface FiltroAgenda {
  unidadeId?: number;
  de?: string;
  ate?: string;
  pagina?: number;
}

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);

  eventos(filtro: FiltroAgenda) {
    return this.http.get<Evento[]>(`${API_URL}/eventos`, { params: { ...filtro } });
  }

  escalas(filtro: FiltroAgenda) {
    return this.http.get<Escala[]>(`${API_URL}/escalas`, { params: { ...filtro } });
  }

  evento(id: number) { return this.http.get<Evento>(`${API_URL}/eventos/${id}`); }

  escala(id: number) { return this.http.get<Escala>(`${API_URL}/escalas/${id}`); }

  historico(id: number) {
    return firstValueFrom(this.http.get<AlteracaoEscala[]>(`${API_URL}/escalas/${id}/historico`));
  }

  salvarEvento(evento: Evento) {
    const { id, ...pedido } = evento;
    return firstValueFrom(id ? this.http.put<Evento>(`${API_URL}/eventos/${id}`, pedido)
      : this.http.post<Evento>(`${API_URL}/eventos`, pedido));
  }

  salvarEscala(escala: Escala) {
    const { id, ...pedido } = escala;
    return firstValueFrom(id ? this.http.put<Escala>(`${API_URL}/escalas/${id}`, pedido)
      : this.http.post<Escala>(`${API_URL}/escalas`, pedido));
  }
}
