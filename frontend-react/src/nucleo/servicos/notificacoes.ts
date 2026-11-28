import { useCallback, useEffect, useRef, useState } from 'react';
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

export const ROTAS_DESTINO: Record<Notificacao['destino'], string> = {
  FICHA: '/app/fichas', PAGAMENTO: '/app/pagamentos-manobristas', EVENTO: '/app/eventos', ESCALA: '/app/escalas',
};

/** Rota que a notificação abre (a mesma da central em /app/notificacoes). */
export const rotaDaNotificacao = (n: Pick<Notificacao, 'destino' | 'destinoId'>) =>
  `${ROTAS_DESTINO[n.destino]}?detalhe=${n.destinoId}${n.destino === 'PAGAMENTO' ? '&aba=historico' : ''}`;

/** "agora", "há 5 min", "há 3 h", "ontem" ou "há 4 dias". */
export function quandoRelativo(iso: string, agora = Date.now()): string {
  const min = Math.floor((agora - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const MAX_AVISOS = 5;

export interface Avisos {
  /** Total de não lidas (null = indisponível ou ainda não buscado). */
  total: number | null;
  /** Até 5: as não lidas; sem nenhuma, as recentes (com `lida`). Só carregado com o painel aberto ou quando há novidade. */
  itens: Notificacao[];
  carregado: boolean;
  /** Notificação que acabou de chegar (id novo depois da primeira leitura); nulo se nada novo. */
  nova: Notificacao | null;
  marcarLidas: () => Promise<void>;
  /** Marca uma só como lida (ao abrir o destino). */
  marcarLida: (id: number) => void;
}

/**
 * Avisos do Perdidinho: UM ciclo de busca (o do total, a cada 30 s/foco/push). A lista só é pedida quando o total muda ou o
 * painel abre; a chegada de um id maior que o já visto vira `nova`.
 */
export function useAvisos(painelAberto: boolean): Avisos {
  const total = useTotalNaoLidas();
  const conta = useAuth((s) => (podeAcessar(s.usuario?.nivel, 'notificacoes') ? (s.usuario?.id ?? null) : null));
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [nova, setNova] = useState<Notificacao | null>(null);
  const maiorVisto = useRef<number | null>(null);

  useEffect(() => {
    maiorVisto.current = null;
    setItens([]);
    setCarregado(false);
    setNova(null);
  }, [conta]);

  useEffect(() => {
    if (conta === null || total === null) return;
    const controle = new AbortController();
    (async () => {
      try {
        const naoLidas = (await notificacoesServico.listar(true)).sort((a, b) => b.id - a.id);
        if (controle.signal.aborted) return;
        const maior = naoLidas[0]?.id ?? 0;
        if (maiorVisto.current === null) maiorVisto.current = maior;
        else if (maior > maiorVisto.current) { maiorVisto.current = maior; setNova(naoLidas[0]); }
        let lista = naoLidas;
        if (!naoLidas.length && painelAberto) {
          lista = (await notificacoesServico.listar(false)).sort((a, b) => b.id - a.id);
          if (controle.signal.aborted) return;
        }
        setItens(lista.slice(0, MAX_AVISOS));
        setCarregado(true);
      } catch { /* sem lista: o contador continua valendo */ }
    })();
    return () => controle.abort();
  }, [conta, total, painelAberto]);

  const marcarLidas = useCallback(async () => {
    await notificacoesServico.ler();
    setItens((atual) => atual.map((n) => ({ ...n, lida: true })));
    notificacoesServico.atualizarContador();
  }, []);

  const marcarLida = useCallback((id: number) => {
    setItens((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    notificacoesServico.ler(id).catch(() => undefined).finally(() => notificacoesServico.atualizarContador());
  }, []);

  return { total, itens, carregado, nova, marcarLidas, marcarLida };
}
