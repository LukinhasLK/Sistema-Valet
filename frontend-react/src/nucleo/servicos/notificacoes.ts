import { useEffect, useState } from 'react';
import { useAuth } from '../estado/auth';
import { api } from './api';
import { podeAcessar } from './permissoes';

const URL = '/notificacoes';
export const CATEGORIAS = {
  FICHA_CRIADA: 'Ficha registrada',
  FICHA_AGUARDANDO_FECHAMENTO: 'Ficha aguardando fechamento',
  PAGAMENTO_PENDENTE: 'Pagamento pendente',
  PAGAMENTO_CONFIRMADO: 'Pagamento confirmado',
  DIVERGENCIA_FINANCEIRA: 'Divergência financeira',
  EVENTO_PROXIMO: 'Evento próximo',
  ESCALA_ALTERADA: 'Escala alterada',
};
export type Categoria = keyof typeof CATEGORIAS;

export interface Notificacao {
  id: number;
  categoria: Categoria;
  titulo: string;
  destino: 'FICHA' | 'PAGAMENTO' | 'EVENTO' | 'ESCALA';
  destinoId: number;
  criadoEm: string;
  lida: boolean;
}

export interface PreferenciaNotificacao {
  categoria: Categoria;
  ativa: boolean;
}

/** Pedidos de recontagem (ex.: depois de marcar como lida). */
const ouvintesRecarga = new Set<() => void>();

export const notificacoesServico = {
  atualizarContador: () => ouvintesRecarga.forEach((ouvinte) => ouvinte()),
  listar: (soNaoLidas: boolean, antes?: number) => api.get<Notificacao[]>(URL, { naoLidas: soNaoLidas, antes }),
  ler: (id?: number) => api.put<void>(id === undefined ? `${URL}/leitura` : `${URL}/${id}/leitura`, {}),
  preferencias: () => api.get<PreferenciaNotificacao[]>(`${URL}/preferencias`),
  preferir: (categoria: Categoria, ativa: boolean) => api.put<void>(`${URL}/preferencias/${categoria}`, { ativa }),
  divergencia: (ficha: number, motivo: string) => api.post<void>(`${URL}/divergencias/${ficha}`, { motivo }),
};

export function useNotificacoesDisponiveis(): boolean {
  return useAuth((s) => podeAcessar(s.usuario?.nivel, 'notificacoes'));
}

/** Total de não lidas: a cada 30 s, ao voltar o foco, ao pedir recontagem e quando o service worker avisa. */
export function useTotalNaoLidas(): number | null {
  const conta = useAuth((s) => (podeAcessar(s.usuario?.nivel, 'notificacoes') ? (s.usuario?.id ?? null) : null));
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (conta === null) {
      setTotal(null);
      return;
    }
    let atual: AbortController | null = null;
    const buscar = () => {
      atual?.abort();
      const controle = (atual = new AbortController());
      api.get<{ total: number }>(`${URL}/pendentes`, undefined, controle.signal)
        .then((r) => { if (!controle.signal.aborted) setTotal(r.total); })
        .catch(() => { if (!controle.signal.aborted) setTotal(null); });
    };
    const doWorker = (e: MessageEvent) => { if (e.data?.tipo === 'PARKFLASH_NOTIFICACAO') buscar(); };

    buscar();
    const intervalo = setInterval(buscar, 30_000);
    window.addEventListener('focus', buscar);
    ouvintesRecarga.add(buscar);
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', doWorker);
    return () => {
      atual?.abort();
      clearInterval(intervalo);
      window.removeEventListener('focus', buscar);
      ouvintesRecarga.delete(buscar);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', doWorker);
    };
  }, [conta]);

  return total;
}
