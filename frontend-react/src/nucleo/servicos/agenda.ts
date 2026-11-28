import { api } from './api';

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

type P = Record<string, string | number | undefined>;

export const agendaServico = {
  eventos: (filtro: FiltroAgenda, sinal?: AbortSignal) => api.get<Evento[]>('/eventos', { ...filtro } as P, sinal),
  escalas: (filtro: FiltroAgenda, sinal?: AbortSignal) => api.get<Escala[]>('/escalas', { ...filtro } as P, sinal),
  evento: (id: number) => api.get<Evento>(`/eventos/${id}`),
  escala: (id: number) => api.get<Escala>(`/escalas/${id}`),
  historico: (id: number) => api.get<AlteracaoEscala[]>(`/escalas/${id}/historico`),
  salvarEvento(evento: Evento) {
    const { id, ...pedido } = evento;
    return id ? api.put<Evento>(`/eventos/${id}`, pedido) : api.post<Evento>('/eventos', pedido);
  },
  salvarEscala(escala: Escala) {
    const { id, ...pedido } = escala;
    return id ? api.put<Escala>(`/escalas/${id}`, pedido) : api.post<Escala>('/escalas', pedido);
  },
};
