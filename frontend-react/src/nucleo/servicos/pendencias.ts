import { useEffect, useMemo, useState, type RefObject } from 'react';
import { create } from 'zustand';
import { useAuth } from '../estado/auth';
import { api, ErroHttp } from './api';
import { podeAcessar } from './permissoes';
import { listarRascunhos, ResumoRascunho } from './rascunho-ficha';
import { carregar, salvar } from './storage';

/**
 * Pendências do "Perdidinho ajudante": o que precisa de ação agora (some sozinha quando resolvida).
 * O sino (notificações) continua sendo "o que aconteceu"; notificações NÃO contam aqui.
 *
 * Contrato de GET /api/pendencias: lista de `{ id, tipo, nivel, quantidade, rota }` só do nível do usuário
 * (o texto é montado aqui, a partir de tipo + quantidade). Além disso entram duas pendências locais:
 * rascunho de ficha guardado no aparelho e "sem conexão".
 */

export type NivelPendencia = 'URGENTE' | 'ATENCAO' | 'INFO';

export interface PendenciaServidor {
  id: string;
  tipo: string;
  nivel: NivelPendencia;
  quantidade: number;
  rota: string;
}

/** Pendência pronta para exibir. `rota` nula = só informa (ex.: sem conexão). */
export interface ItemPendencia {
  id: string;
  nivel: NivelPendencia;
  quantidade: number;
  rota: string | null;
  texto: string;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** Texto de cada tipo (o servidor só manda tipo + quantidade). */
export function textoDaPendencia(tipo: string, n: number, nivel: NivelPendencia = 'ATENCAO'): string {
  switch (tipo) {
    case 'prontas': return `${n} ${plural(n, 'ficha esperando', 'fichas esperando')} sua conferência.`;
    case 'diariasAConferir': return `${n} ${plural(n, 'diária', 'diárias')} para reconhecer.`;
    case 'manobristasAPagar': return `Diárias de ${n} ${plural(n, 'manobrista', 'manobristas')} a pagar.`;
    case 'eventosHojeAmanha': return `Hoje e amanhã: ${n} ${plural(n, 'evento', 'eventos')} na agenda.`;
    case 'fichasAbertasMes':
      return nivel === 'INFO'
        ? `${n} ${plural(n, 'ficha do mês ainda aberta', 'fichas do mês ainda abertas')}; o lucro pode mudar.`
        : `${n} ${plural(n, 'ficha ainda não enviada trava', 'fichas ainda não enviadas travam')} a divisão de lucro.`;
    case 'unidadesSemRateio': return `${n} ${plural(n, 'unidade sem divisão', 'unidades sem divisão')} entre sócios.`;
    case 'rascunho': return n === 1 ? 'Você tem uma ficha começada neste aparelho.' : `Você tem ${n} fichas começadas neste aparelho.`;
    case 'semConexao': return 'Sem conexão. Tento de novo sozinho.';
    default: return `${n} ${plural(n, 'pendência', 'pendências')}.`;
  }
}

const ORDEM: Record<NivelPendencia, number> = { URGENTE: 0, ATENCAO: 1, INFO: 2 };

/** Rota do rascunho mais recente (ficha nova ou edição de uma ficha). */
export function rotaDoRascunho(r: ResumoRascunho): string {
  return r.fichaId === null ? '/app/fichas/nova' : `/app/fichas/${r.fichaId}/editar`;
}

interface Entrada {
  servidor: PendenciaServidor[];
  rascunhos: ResumoRascunho[];
  semConexao: boolean;
  /** Tela aberta agora: um rascunho dessa própria tela não é pendência (a pessoa já está nele). */
  rotaAtual?: string;
}

/** Junta o que veio do servidor com o que é local, ordenado por urgência. */
export function montarItens({ servidor, rascunhos, semConexao, rotaAtual }: Entrada): ItemPendencia[] {
  const itens: ItemPendencia[] = servidor.filter((p) => p.quantidade > 0).map((p) => ({
    id: p.id, nivel: p.nivel, quantidade: p.quantidade, rota: p.rota, texto: textoDaPendencia(p.tipo, p.quantidade, p.nivel),
  }));
  const abertos = rascunhos.filter((r) => rotaDoRascunho(r) !== rotaAtual);
  if (abertos.length) {
    itens.push({ id: 'rascunho', nivel: 'ATENCAO', quantidade: abertos.length, rota: rotaDoRascunho(abertos[0]), texto: textoDaPendencia('rascunho', abertos.length) });
  }
  if (semConexao) itens.push({ id: 'semConexao', nivel: 'INFO', quantidade: 1, rota: null, texto: textoDaPendencia('semConexao', 1) });
  return itens.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

export type NivelGeral = 'nada' | 'info' | 'atencao' | 'urgente';

export interface ResumoPendencias {
  nivel: NivelGeral;
  /** Número de PENDÊNCIAS (itens), não soma de quantidades; "sem conexão" não conta. */
  contador: number;
  /** Itens urgentes. */
  urgentes: number;
  rotulo: string;
}

export function resumir(itens: ItemPendencia[]): ResumoPendencias {
  const contados = itens.filter((i) => i.id !== 'semConexao');
  const urgentes = contados.filter((i) => i.nivel === 'URGENTE').length;
  const atencao = contados.filter((i) => i.nivel === 'ATENCAO').length;
  const temInfo = itens.some((i) => i.nivel === 'INFO');
  const nivel: NivelGeral = urgentes ? 'urgente' : atencao ? 'atencao' : temInfo ? 'info' : 'nada';
  const contador = contados.length;
  const rotulo = contador
    ? `Pendências: ${contador}${urgentes ? `, ${urgentes} ${urgentes === 1 ? 'urgente' : 'urgentes'}` : ''}`
    : temInfo ? 'Pendências: só avisos para saber' : 'Pendências: nenhuma';
  return { nivel, contador, urgentes, rotulo };
}

/* ------------------------------------------------------------------------- */
/* Servidor                                                                   */
/* ------------------------------------------------------------------------- */

const LIMITE_MS = 20_000;

interface EstadoPendencias {
  usuarioId: number | null;
  itens: PendenciaServidor[];
  /** Quando a última resposta chegou (o ajudante reavalia o aceno a cada resposta). */
  carregadoEm: number;
  /** A última tentativa falhou por falta de rede (status 0). */
  offline: boolean;
}

const VAZIO: EstadoPendencias = { usuarioId: null, itens: [], carregadoEm: 0, offline: false };
export const usePendenciasStore = create<EstadoPendencias>(() => VAZIO);

let ultima = 0;
let emAndamento: Promise<void> | null = null;

export const pendenciasServico = {
  /** Recarrega do servidor. Ignora chamadas a menos de 20 s da última (a não ser com `forcar`) e falhas. */
  atualizar(forcar = false): Promise<void> {
    const usuarioId = useAuth.getState().usuario?.id ?? null;
    if (usuarioId === null) return Promise.resolve();
    if (emAndamento) return emAndamento;
    if (!forcar && Date.now() - ultima < LIMITE_MS) return Promise.resolve();
    ultima = Date.now();
    emAndamento = api.get<PendenciaServidor[]>('/pendencias')
      .then((itens) => {
        if (useAuth.getState().usuario?.id !== usuarioId) return;
        usePendenciasStore.setState({ usuarioId, itens, carregadoEm: Date.now(), offline: false });
      })
      .catch((erro) => {
        if (erro instanceof ErroHttp && erro.status === 0 && useAuth.getState().usuario?.id === usuarioId) {
          usePendenciasStore.setState({ offline: true });
        }
      })
      .finally(() => { emAndamento = null; });
    return emAndamento;
  },

  /** Troca de usuário ou logout: nada do anterior sobra. */
  reiniciar(): void {
    ultima = 0;
    emAndamento = null;
    usePendenciasStore.setState(VAZIO);
    reiniciarChamadas();
  },
};

// Logout ou troca de conta: nada do usuário anterior sobra (pendências, acenos já dados).
useAuth.subscribe((estado, anterior) => {
  if (estado.usuario?.id !== anterior.usuario?.id) pendenciasServico.reiniciar();
});

/* ------------------------------------------------------------------------- */
/* Silenciar até amanhã                                                       */
/* ------------------------------------------------------------------------- */

const CHAVE_SILENCIO = 'parkflash.pendencias.silencio';
const FUSO = 'America/Sao_Paulo';

/** Meia-noite seguinte em São Paulo (sem horário de verão desde 2019: UTC−3 fixo). */
export function proximaMeiaNoiteSP(agora = new Date()): number {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  const [a, m, d] = hoje.split('-').map(Number);
  return Date.UTC(a, m - 1, d + 1, 3, 0, 0);
}

type MapaSilencio = Record<string, number>;

export const silencioServico = {
  ate(usuario: number): number {
    return carregar<MapaSilencio>(CHAVE_SILENCIO, {})[usuario] ?? 0;
  },
  ativo(usuario: number, agora = new Date()): boolean {
    return silencioServico.ate(usuario) > agora.getTime();
  },
  silenciar(usuario: number, agora = new Date()): void {
    salvar(CHAVE_SILENCIO, { ...limpos(agora), [usuario]: proximaMeiaNoiteSP(agora) });
    avisarSilencio();
  },
  voltar(usuario: number, agora = new Date()): void {
    const mapa = limpos(agora);
    delete mapa[usuario];
    salvar(CHAVE_SILENCIO, mapa);
    avisarSilencio();
  },
};

/** Entradas vencidas saem do armazenamento. */
function limpos(agora: Date): MapaSilencio {
  const mapa = carregar<MapaSilencio>(CHAVE_SILENCIO, {});
  return Object.fromEntries(Object.entries(mapa).filter(([, ate]) => ate > agora.getTime()));
}

const ouvintesSilencio = new Set<() => void>();
const avisarSilencio = () => ouvintesSilencio.forEach((o) => o());

export function useSilenciado(): boolean {
  const usuario = useAuth((s) => s.usuario?.id ?? null);
  const [, nova] = useState(0);
  useEffect(() => {
    const ouvir = () => nova((n) => n + 1);
    ouvintesSilencio.add(ouvir);
    return () => { ouvintesSilencio.delete(ouvir); };
  }, []);
  return usuario !== null && silencioServico.ativo(usuario);
}

/* ------------------------------------------------------------------------- */
/* Chamada (aceno)                                                            */
/* ------------------------------------------------------------------------- */

/** Intervalo mínimo entre dois acenos. */
export const INTERVALO_ACENO_MS = 10 * 60_000;

const avisados = new Set<string>();
let ultimoAceno = 0;

function reiniciarChamadas(): void {
  avisados.clear();
  ultimoAceno = 0;
}

interface EntradaAceno {
  /** Ids das pendências urgentes de agora. */
  urgentes: string[];
  silenciado: boolean;
  /** Campo focado, ficha nova/edição, tour, modal ou paleta abertos. */
  quieto: boolean;
  agora?: number;
}

/**
 * Decide se o Perdidinho acena agora: só para urgência que ainda não chamou atenção (no máximo uma vez por
 * pendência), com 10 minutos de intervalo, e nunca em silêncio ou em momento quieto. Quem chama o aceno
 * deve registrá-lo com `registrarAceno`.
 */
export function decidirAceno({ urgentes, silenciado, quieto, agora = Date.now() }: EntradaAceno): string[] {
  if (silenciado || quieto) return [];
  if (agora - ultimoAceno < INTERVALO_ACENO_MS) return [];
  return urgentes.filter((id) => !avisados.has(id));
}

export function registrarAceno(ids: string[], agora = Date.now()): void {
  ids.forEach((id) => avisados.add(id));
  ultimoAceno = agora;
}

/** Só para testes. */
export const reiniciarChamadasParaTeste = reiniciarChamadas;

/* ------------------------------------------------------------------------- */
/* Presença: um Perdidinho com olhos por vez                                  */
/* ------------------------------------------------------------------------- */

/** Quantos Perdidinhos "de tela" (estado vazio, ficha fechada, sem conexão) estão à vista. */
export const usePresenca = create<{ total: number }>(() => ({ total: 0 }));

/** Registra uma presença. Devolve a limpeza (seguro sob StrictMode: cada registro soma e desfaz um). */
export function registrarPresenca(): () => void {
  usePresenca.setState((s) => ({ total: s.total + 1 }));
  let desfeita = false;
  return () => {
    if (desfeita) return;
    desfeita = true;
    usePresenca.setState((s) => ({ total: Math.max(0, s.total - 1) }));
  };
}

/**
 * Enquanto montado (e `ativa`), este Perdidinho é o que tem olhos: o do ajudante vira silhueta.
 * Com `ref`, só conta enquanto o elemento está de fato à vista na tela (um Perdidinho lá embaixo,
 * fora da vista, não apaga os olhos do ajudante). Sem `ref` (tela cheia), conta enquanto montado.
 */
export function usePresencaPerdidinho(ativa = true, ref?: RefObject<Element | null>): void {
  useEffect(() => {
    if (!ativa) return undefined;
    const el = ref?.current;
    if (!ref || !el || typeof IntersectionObserver === 'undefined') return registrarPresenca();
    let desfazer: (() => void) | null = null;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !desfazer) desfazer = registrarPresenca();
      else if (!e.isIntersecting && desfazer) { desfazer(); desfazer = null; }
    });
    obs.observe(el);
    return () => { obs.disconnect(); desfazer?.(); };
  }, [ativa, ref]);
}

/* ------------------------------------------------------------------------- */
/* Hook                                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Pendências do usuário logado: servidor (atualizado pelo ciclo de `atualizacao.ts`, ao trocar de rota e ao montar)
 * mais as locais (rascunho e sem conexão). `rotaAtual` re-lê o rascunho e dispara a atualização do servidor.
 */
export function usePendencias(rotaAtual: string): { itens: ItemPendencia[]; resumo: ResumoPendencias; carregadoEm: number } {
  const usuario = useAuth((s) => s.usuario);
  const usuarioId = usuario?.id ?? null;
  const nivel = usuario?.nivel ?? null;
  const servidor = usePendenciasStore((s) => (s.usuarioId === usuarioId ? s.itens : []));
  const carregadoEm = usePendenciasStore((s) => s.carregadoEm);
  const offline = usePendenciasStore((s) => s.offline);
  const semConexaoAuth = useAuth((s) => s.semConexao);
  const [leitura, reler] = useState(0);

  // Servidor: ao montar (e ao trocar de usuário) e ao trocar de rota (o limite de 20 s evita rajada).
  useEffect(() => {
    if (usuarioId === null) return;
    void pendenciasServico.atualizar();
  }, [usuarioId, rotaAtual]);

  // Rascunho mora no aparelho: relê ao voltar o foco e quando outra aba grava.
  useEffect(() => {
    const ler = () => reler((n) => n + 1);
    window.addEventListener('focus', ler);
    window.addEventListener('storage', ler);
    return () => {
      window.removeEventListener('focus', ler);
      window.removeEventListener('storage', ler);
    };
  }, []);

  const rascunhos = useMemo(
    () => (usuarioId !== null && podeAcessar(nivel, 'fichas/nova') ? listarRascunhos(usuarioId) : []),
    // `rotaAtual` e `leitura` são gatilhos de releitura do localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuarioId, nivel, rotaAtual, leitura],
  );

  const itens = useMemo(
    () => montarItens({ servidor, rascunhos, semConexao: offline || semConexaoAuth, rotaAtual }),
    [servidor, rascunhos, offline, semConexaoAuth, rotaAtual],
  );
  const resumo = useMemo(() => resumir(itens), [itens]);
  return { itens, resumo, carregadoEm };
}
