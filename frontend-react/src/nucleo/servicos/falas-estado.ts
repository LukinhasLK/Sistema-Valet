import { create } from 'zustand';
import type { HumorMascote } from '../onboarding/mascote';
import { carregar, remover, salvar } from './storage';

/**
 * Estado das falas do Perdidinho que não depende de mais nada (por isso vive separado de `falas.ts`):
 * tipos, evento "ficha lançada" (fala 12), memória "já falei" por usuário e a fala que está na tela agora.
 */

export type CanalFala = 'balao' | 'painel';
export type PrioridadeFala = 1 | 2 | 3 | 4;

export interface Fala {
  /** Estável por assunto (ex.: `resumoOntem`, `unidadeNegativa:3`, `rascunho:nova`). */
  id: string;
  /** Número da fala no brief (1, 5, 6, 11…). */
  numero: number;
  /** `balao` = vira balão (desktop) ou faixa (celular); todas as falas com `noPainel` entram em "Hoje o Perdidinho disse". */
  canais: CanalFala[];
  prioridade: PrioridadeFala;
  humor: HumorMascote;
  texto: string;
  acao?: { rotulo: string; rota: string };
  /** Período da memória "já falei": mudou a chave, pode falar de novo. */
  chave: string;
  /** Epoch ms: a fala vence à meia-noite de São Paulo. */
  validaAte: number;
  /** Aparece no histórico do painel (falas que já têm um item próprio no painel ficam de fora, sem duplicar). */
  noPainel: boolean;
  /** Fala 5: vira item ATENÇÃO do painel, com esta quantidade (dias seguidos). */
  quantidade?: number;
}

/* ------------------------------------------------------------------------- */
/* Evento: ficha nova lançada (fala 12)                                       */
/* ------------------------------------------------------------------------- */

export interface EventoFichaLancada {
  fichaId: number;
  unidadeId: number;
  carros: number;
  em: number;
}

export const useFalaEvento = create<{ fichaLancada: EventoFichaLancada | null }>(() => ({ fichaLancada: null }));

export const falaEventos = {
  fichaLancada(e: Omit<EventoFichaLancada, 'em'>): void {
    useFalaEvento.setState({ fichaLancada: { ...e, em: Date.now() } });
  },
  limparFichaLancada(): void {
    if (useFalaEvento.getState().fichaLancada) useFalaEvento.setState({ fichaLancada: null });
  },
};

/* ------------------------------------------------------------------------- */
/* Fala na tela agora (balão no desktop, faixa no celular)                    */
/* ------------------------------------------------------------------------- */

export const useFalaAtiva = create<{ ativa: Fala | null }>(() => ({ ativa: null }));

/* ------------------------------------------------------------------------- */
/* Memória "já falei" (localStorage, por usuário)                             */
/* ------------------------------------------------------------------------- */

const CHAVE_MEMORIA = 'parkflash.falas';

export interface MemoriaFalas {
  /** `{ [falaId]: chaveDoPeriodo }`. */
  ditas: Record<string, string>;
  /** Dia (São Paulo) a que os contadores abaixo se referem. */
  dia: string;
  baloes: number;
  faixas: number;
  /** Último balão, faixa ou aceno de urgência (epoch ms): o intervalo de 15 min vale para os três. */
  ultimoEm: number;
}

type Mapa = Record<string, MemoriaFalas>;

const vazia = (dia: string): MemoriaFalas => ({ ditas: {}, dia, baloes: 0, faixas: 0, ultimoEm: 0 });

/** Dia civil em America/Sao_Paulo (`YYYY-MM-DD`). */
export function diaSP(agora: Date | number = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export const memoriaServico = {
  /** Memória do usuário; os contadores do dia zeram na virada do dia. */
  ler(usuario: number, agora: number = Date.now()): MemoriaFalas {
    const dia = diaSP(agora);
    const m = carregar<Mapa>(CHAVE_MEMORIA, {})[usuario];
    if (!m) return vazia(dia);
    return m.dia === dia ? m : { ...m, dia, baloes: 0, faixas: 0 };
  },
  /** Registra que a fala foi dita agora (balão ou faixa). */
  registrar(usuario: number, fala: Pick<Fala, 'id' | 'chave'>, canal: 'balao' | 'faixa', agora: number = Date.now()): void {
    const m = memoriaServico.ler(usuario, agora);
    gravar(usuario, {
      ...m,
      ditas: { ...m.ditas, [fala.id]: fala.chave },
      baloes: m.baloes + (canal === 'balao' ? 1 : 0),
      faixas: m.faixas + (canal === 'faixa' ? 1 : 0),
      ultimoEm: agora,
    });
  },
  /** Um aceno de urgência entra no mesmo intervalo dos balões, sem contar no limite do dia. */
  marcarAceno(usuario: number, agora: number = Date.now()): void {
    gravar(usuario, { ...memoriaServico.ler(usuario, agora), ultimoEm: agora });
  },
  /** Logout explícito (aparelho compartilhado). */
  esquecer(usuario: number): void {
    const mapa = carregar<Mapa>(CHAVE_MEMORIA, {});
    delete mapa[usuario];
    if (Object.keys(mapa).length) salvar(CHAVE_MEMORIA, mapa); else remover(CHAVE_MEMORIA);
  },
};

function gravar(usuario: number, memoria: MemoriaFalas): void {
  salvar(CHAVE_MEMORIA, { ...carregar<Mapa>(CHAVE_MEMORIA, {}), [usuario]: memoria });
}
