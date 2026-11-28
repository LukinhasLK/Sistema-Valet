import { api, API_URL } from './api';

/** Situação do link de agenda da conta. O link em si só volta do servidor quando é gerado. */
export interface LinkAgenda {
  ativo: boolean;
  criadoEm: string | null;
}

export interface NovoLinkAgenda {
  token: string;
  criadoEm: string;
}

/** Página do Google Calendar para adicionar uma agenda pela URL. */
export const GOOGLE_ADICIONAR_POR_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl';

/** Endereço completo que o Google Calendar assina (precisa ser público, com https). */
export function urlDoLink(token: string, origem: string = window.location.origin): string {
  return `${origem.replace(/\/+$/, '')}${API_URL}/agenda/${encodeURIComponent(token)}.ics`;
}

export const calendarioServico = {
  consultar: () => api.get<LinkAgenda>('/agenda/link'),
  gerar: () => api.post<NovoLinkAgenda>('/agenda/link'),
  desativar: () => api.delete('/agenda/link'),
};
