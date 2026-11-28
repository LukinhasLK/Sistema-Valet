import { useEffect, useMemo, useState } from 'react';
import { moeda } from '../../compartilhado/formatos';
import { useUsuario } from '../estado/auth';
import { useFichas } from '../estado/fichas';
import { useUnidades } from '../estado/unidades';
import type { Ficha, NivelAcesso } from '../modelos';
import { Fala, memoriaServico, MemoriaFalas, useFalaAtiva, diaSP } from './falas-estado';
import { ItemPendencia, PendenciaServidor, proximaMeiaNoiteSP, registrarAceno, rotaDoRascunho, usePendenciasStore, useSilenciado } from './pendencias';
import { formatarData } from './periodo';
import { podeAcessar, rotaInicial } from './permissoes';
import { lerRascunho, listarRascunhos, ResumoRascunho } from './rascunho-ficha';

export type { Fala } from './falas-estado';

/**
 * Motor de falas do Perdidinho: só fala com fato verificável + ação. Duas camadas:
 * - funções PURAS `(dados, nivel, hoje) → Fala[]` (`gerarFalas`) e as regras anti-irritação (`decidirBalao`);
 * - o hook `useMotorDeFalas`, que lê os stores, espera 1,5 s e publica a fala em `useFalaAtiva`
 *   (balão no desktop, faixa no celular). Tudo que vira balão também aparece em "Hoje o Perdidinho disse".
 * Limites: 2 balões/dia (1 faixa/dia no celular), 15 min entre eles (o aceno de urgência entra no mesmo intervalo),
 * uma fala por vez, por prioridade, vencendo à meia-noite de São Paulo. "Silenciar até amanhã" corta o balão.
 */

export const MAX_BALOES_DIA = 2;
export const MAX_FAIXAS_DIA = 1;
export const INTERVALO_BALAO_MS = 15 * 60_000;
export const ATRASO_BALAO_MS = 1500;
/** Fala 5: a partir de quantos dias seguidos no negativo, e a faixa em que fala de novo. */
export const NEGATIVO_MINIMO = 3;
export const NEGATIVO_REFORCO = 7;
/** Fala 6: a ficha mais antiga precisa ter pelo menos estes dias. */
export const PRONTA_ATRASO_MIN_DIAS = 2;

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/* ------------------------------------------------------------------------- */
/* Datas                                                                      */
/* ------------------------------------------------------------------------- */

export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function diasEntre(deIso: string, ateIso: string): number {
  const t = (s: string) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((t(ateIso) - t(deIso)) / 86_400_000);
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------------------- */
/* Geração das falas (puro)                                                   */
/* ------------------------------------------------------------------------- */

export interface RascunhoParaFala extends ResumoRascunho {
  unidadeId: number | null;
}

export interface DadosFalas {
  /** Fichas do usuário, como o servidor entregou (já no escopo dele). CANCELADA é ignorada nas contas. */
  fichas: Ficha[];
  unidades: { id: number; nome: string }[];
  pendencias: PendenciaServidor[];
  /** A resposta de /api/pendencias já chegou (sem ela, as falas 1 e 6 não acontecem). */
  pendenciasCarregadas: boolean;
  rascunhos: RascunhoParaFala[];
}

const ativas = (fichas: Ficha[]) => fichas.filter((f) => f.situacao !== 'CANCELADA');
const arred = (n: number) => Math.round(n * 100) / 100;

/** Fala 1: resumo de ontem. */
function falaResumoOntem(d: DadosFalas, hoje: string, validaAte: number): Fala | null {
  if (!d.pendenciasCarregadas) return null;
  const ontem = somarDias(hoje, -1);
  const deOntem = ativas(d.fichas).filter((f) => f.data === ontem);
  if (!deOntem.length) return null;
  const carros = deOntem.reduce((s, f) => s + f.totalCarros, 0);
  const liquido = arred(deOntem.reduce((s, f) => s + f.totalLiquido, 0));
  const aConferir = d.pendencias.find((p) => p.tipo === 'prontas')?.quantidade ?? 0;
  const conferir = aConferir > 0 ? ` ${aConferir} ${plural(aConferir, 'ficha para conferir', 'fichas para conferir')}.` : '';
  return {
    id: 'resumoOntem', numero: 1, canais: ['balao', 'painel'], prioridade: 3, noPainel: true,
    humor: liquido < 0 ? 'pensando' : 'explicando',
    texto: `Ontem: ${carros} ${plural(carros, 'carro', 'carros')}, ${moeda(liquido)} líquido das fichas.${conferir}`,
    acao: aConferir > 0
      ? { rotulo: 'Conferir', rota: '/app/fichas?situacao=PRONTA&mes=0' }
      : { rotulo: 'Ver ontem', rota: `/app/fichas?mes=${Number(ontem.slice(5, 7))}&ano=${ontem.slice(0, 4)}&busca=${ontem}` },
    chave: `resumoOntem:${ontem}`, validaAte,
  };
}

export interface SequenciaNegativa {
  unidadeId: number;
  dias: number;
  /** Primeiro dia da sequência. */
  inicio: string;
}

/**
 * Por unidade: dias consecutivos de calendário, terminando ontem, COM fichas e soma do líquido abaixo de zero.
 * Um dia sem ficha quebra a sequência.
 */
export function sequenciasNegativas(fichas: Ficha[], hoje: string): SequenciaNegativa[] {
  const porUnidade = new Map<number, Map<string, number>>();
  for (const f of ativas(fichas)) {
    const dias = porUnidade.get(f.unidadeId) ?? new Map<string, number>();
    dias.set(f.data, arred((dias.get(f.data) ?? 0) + f.totalLiquido));
    porUnidade.set(f.unidadeId, dias);
  }
  const saida: SequenciaNegativa[] = [];
  for (const [unidadeId, dias] of porUnidade) {
    let n = 0;
    let dia = somarDias(hoje, -1);
    while ((dias.get(dia) ?? 0) < 0 && dias.has(dia)) { n++; dia = somarDias(dia, -1); }
    if (n > 0) saida.push({ unidadeId, dias: n, inicio: somarDias(dia, 1) });
  }
  return saida;
}

/** Fala 5: unidade no negativo há 3+ dias (de novo ao chegar a 7). */
function falasUnidadeNegativa(d: DadosFalas, hoje: string, validaAte: number): Fala[] {
  return sequenciasNegativas(d.fichas, hoje)
    .filter((s) => s.dias >= NEGATIVO_MINIMO)
    .flatMap((s) => {
      const unidade = d.unidades.find((u) => u.id === s.unidadeId);
      if (!unidade) return [];
      const faixa = s.dias >= NEGATIVO_REFORCO ? NEGATIVO_REFORCO : NEGATIVO_MINIMO;
      const ano = hoje.slice(0, 4);
      return [{
        id: `unidadeNegativa:${s.unidadeId}`, numero: 5, canais: ['balao', 'painel'], prioridade: 1, noPainel: false,
        humor: 'pensando', quantidade: s.dias,
        texto: `${unidade.nome} fechou no negativo ${s.dias} dias seguidos.`,
        acao: { rotulo: `Ver ${unidade.nome}`, rota: `/app/fichas?unidadeId=${s.unidadeId}&mes=0&ano=${ano}` },
        chave: `${s.inicio}:${faixa}`, validaAte,
      } satisfies Fala];
    });
}

/** Fala 6: fichas PRONTA esperando há mais de 1 dia (dado do servidor). */
function falaProntasAtrasadas(d: DadosFalas, hoje: string, validaAte: number): Fala | null {
  if (!d.pendenciasCarregadas) return null;
  const p = d.pendencias.find((x) => x.tipo === 'prontasAtrasadas');
  if (!p || p.quantidade <= 0 || !p.maisAntigaData || !p.maisAntigaUnidade) return null;
  if (diasEntre(p.maisAntigaData, hoje) < PRONTA_ATRASO_MIN_DIAS) return null;
  const n = p.quantidade;
  const data = formatarData(p.maisAntigaData);
  return {
    id: 'prontasAtrasadas', numero: 6, canais: ['balao', 'painel'], prioridade: 2, noPainel: true, humor: 'apontando',
    texto: n === 1
      ? `1 ficha espera há mais de 1 dia. É de ${data}, ${p.maisAntigaUnidade}.`
      : `${n} fichas esperando há mais de 1 dia. A mais antiga é de ${data}, ${p.maisAntigaUnidade}.`,
    acao: { rotulo: 'Conferir a mais antiga', rota: p.rota || '/app/fichas?situacao=PRONTA&mes=0&ordem=antigas' },
    chave: `prontasAtrasadas:${hoje}`, validaAte,
  };
}

/** Fala 11: ficha começada e não lançada. */
function falasRascunho(d: DadosFalas, hoje: string, validaAte: number): Fala[] {
  return d.rascunhos.map((r) => {
    const unidade = r.unidadeId !== null ? d.unidades.find((u) => u.id === r.unidadeId)?.nome : undefined;
    const quando = new Date(r.salvoEm);
    const hora = HORA.format(quando);
    const dia = diaSP(quando);
    const em = dia === hoje ? `às ${hora}` : `em ${formatarData(dia).slice(0, 5)} às ${hora}`;
    return {
      id: `rascunho:${r.fichaId ?? 'nova'}`, numero: 11, canais: ['balao', 'painel'], prioridade: 2, noPainel: false, humor: 'apontando',
      texto: `Você começou uma ficha${unidade ? ` de ${unidade}` : ''} ${em}. Continuar?`,
      acao: { rotulo: 'Continuar ficha', rota: rotaDoRascunho(r) },
      chave: `rascunho:${hoje}`, validaAte,
    } satisfies Fala;
  });
}

/**
 * Falas vivas de hoje para o usuário. Sócio não recebe nenhuma nesta etapa; o operador recebe só as de ficha
 * (11 aqui; 10 e 12 são inline nas telas) e nunca valores em dinheiro.
 */
export function gerarFalas(dados: DadosFalas, nivel: NivelAcesso | null | undefined, hoje: Date = new Date()): Fala[] {
  if (nivel !== 'Proprietário' && nivel !== 'Gerente' && nivel !== 'Operador') return [];
  const dia = diaSP(hoje);
  const validaAte = proximaMeiaNoiteSP(hoje);
  const falas: Fala[] = [];
  if (nivel !== 'Operador') {
    const um = falaResumoOntem(dados, dia, validaAte);
    if (um) falas.push(um);
    falas.push(...falasUnidadeNegativa(dados, dia, validaAte));
    const seis = falaProntasAtrasadas(dados, dia, validaAte);
    if (seis) falas.push(seis);
  }
  falas.push(...falasRascunho(dados, dia, validaAte));
  return falas.sort((a, b) => a.prioridade - b.prioridade || a.numero - b.numero);
}

/** Fala 5 vira item ATENÇÃO do painel enquanto a sequência durar. */
export function itensDeAtencaoDasFalas(falas: Fala[]): ItemPendencia[] {
  return falas.filter((f) => f.numero === 5 && f.quantidade).map((f) => ({
    id: f.id, tipo: 'unidadeNegativa', nivel: 'ATENCAO' as const, quantidade: f.quantidade ?? 0,
    rota: f.acao?.rota ?? null, texto: f.texto,
  }));
}

/* ------------------------------------------------------------------------- */
/* Regras anti-irritação (puro)                                               */
/* ------------------------------------------------------------------------- */

export type CanalDeJanela = 'balao' | 'faixa';

/** Em que tela a fala pode aparecer: o balão, na tela inicial do perfil (Painel; Fichas para o operador); a faixa, no Painel ou em Fichas. */
export function rotaPermiteFala(pathname: string, nivel: NivelAcesso | null | undefined, canal: CanalDeJanela): boolean {
  const limpo = pathname.replace(/\/+$/, '');
  if (canal === 'faixa') return limpo === '/app/dashboard' || limpo === '/app/fichas';
  return limpo === rotaInicial(nivel);
}

interface EntradaBalao {
  falas: Fala[];
  memoria: MemoriaFalas;
  agora: number;
  silenciado: boolean;
  canal: CanalDeJanela;
}

/**
 * Qual fala (se alguma) pode virar balão/faixa agora: não silenciado, abaixo do limite do dia, 15 min desde o último
 * balão/aceno, ainda não dita neste período e não vencida; a de maior prioridade (menor número) vence.
 */
export function decidirBalao({ falas, memoria, agora, silenciado, canal }: EntradaBalao): Fala | null {
  if (silenciado) return null;
  const dia = diaSP(agora);
  const doDia = memoria.dia === dia ? memoria : { ...memoria, baloes: 0, faixas: 0 };
  if (canal === 'balao' ? doDia.baloes >= MAX_BALOES_DIA : doDia.faixas >= MAX_FAIXAS_DIA) return null;
  if (agora - doDia.ultimoEm < INTERVALO_BALAO_MS) return null;
  return falas
    .filter((f) => f.canais.includes('balao') && f.validaAte > agora && memoria.ditas[f.id] !== f.chave)
    .sort((a, b) => a.prioridade - b.prioridade || a.numero - b.numero)[0] ?? null;
}

/* ------------------------------------------------------------------------- */
/* Fala 10: avisos inline na Nova ficha (puro)                                */
/* ------------------------------------------------------------------------- */

export interface MotivoFicha {
  texto: string;
  /** Campo (atributo `name`) ou seletor para "Ir para o campo". */
  campo?: string;
  /** Etapa do formulário no celular. */
  etapa?: number;
  /** Bloqueia o lançamento? Saldo negativo e afins NÃO bloqueiam. */
  bloqueia: boolean;
  /** Anunciar ao leitor de tela? (falso para textos com número que muda a cada tecla, como o saldo) */
  anunciar?: boolean;
}

export const textoTicketMenor = (ini: number, fim: number) => `O ticket final (${fim}) está menor que o inicial (${ini}).`;
export const textoSemForma = (nome: string) => `Faltou a forma de pagamento de ${nome}.`;
export const textoSaldo = (saldo: number) => `O saldo ficou ${moeda(saldo)}. Se estiver certo, pode lançar.`;
export const textoSemRecebimento = (carros: number) => `Nenhum recebimento lançado para ${carros} ${plural(carros, 'carro', 'carros')}. Confere?`;
export const textoTicketAnterior = (unidade: string, fim: number) => `A última ficha de ${unidade} terminou no ticket ${fim}.`;

/** A primeira fala + "e mais N". Sem motivos, nada. */
export function resumirMotivos(motivos: MotivoFicha[]): { texto: string; primeiro: MotivoFicha } | null {
  if (!motivos.length) return null;
  const mais = motivos.length - 1;
  return { texto: mais > 0 ? `${motivos[0].texto} (e mais ${mais})` : motivos[0].texto, primeiro: motivos[0] };
}

/** Última ficha ativa da mesma unidade, anterior (data e turno) à que está sendo preenchida. */
export function ultimaFichaAntes(fichas: Ficha[], unidadeId: number, data: string, turno: string, ignorarId?: number): Ficha | null {
  const ordem = (f: Pick<Ficha, 'data' | 'turno'>) => `${f.data}${f.turno === 'noite' ? '1' : '0'}`;
  const alvo = ordem({ data, turno: turno as Ficha['turno'] });
  return ativas(fichas)
    .filter((f) => f.unidadeId === unidadeId && f.id !== ignorarId && ordem(f) < alvo)
    .sort((a, b) => ordem(b).localeCompare(ordem(a)) || b.id - a.id)[0] ?? null;
}

/* ------------------------------------------------------------------------- */
/* Hook: o motor no navegador                                                 */
/* ------------------------------------------------------------------------- */

function lerRascunhosParaFala(usuarioId: number, rotaAtual: string): RascunhoParaFala[] {
  return listarRascunhos(usuarioId)
    .filter((r) => rotaDoRascunho(r) !== rotaAtual)
    .map((r) => {
      const dados = lerRascunho<{ campos?: { unidadeId?: number | null } }>(usuarioId, r.fichaId)?.dados;
      const unidadeId = Number(dados?.campos?.unidadeId);
      return { ...r, unidadeId: Number.isInteger(unidadeId) && unidadeId > 0 ? unidadeId : null };
    });
}

interface OpcoesMotor {
  canal: CanalDeJanela;
  pathname: string;
  /** Campo focado, tour, convite, modal, paleta, painel aberto, outro Perdidinho com olhos à vista… */
  bloqueado: boolean;
}

/**
 * Motor das falas: gera as falas vivas, escolhe a próxima e, depois de 1,5 s sem bloqueio, publica em `useFalaAtiva`.
 * Devolve as falas do histórico do painel e os itens ATENÇÃO derivados (fala 5).
 */
export function useMotorDeFalas({ canal, pathname, bloqueado }: OpcoesMotor): { falas: Fala[]; itensAtencao: ItemPendencia[] } {
  const usuario = useUsuario();
  const usuarioId = usuario?.id ?? null;
  const nivel = usuario?.nivel ?? null;
  const fichas = useFichas((s) => s.fichas);
  const unidades = useUnidades((s) => s.unidades);
  const servidor = usePendenciasStore((s) => (s.usuarioId === usuarioId ? s.itens : null));
  const carregadoEm = usePendenciasStore((s) => s.carregadoEm);
  const silenciado = useSilenciado();
  const [versao, setVersao] = useState(0);
  const [abaOculta, setAbaOculta] = useState(() => typeof document !== 'undefined' && document.hidden);

  // Rascunho mora no aparelho; relógio: reavalia o intervalo de 15 min e a virada do dia.
  useEffect(() => {
    const reler = () => setVersao((n) => n + 1);
    const oculta = () => setAbaOculta(document.hidden);
    const relogio = setInterval(reler, 60_000);
    window.addEventListener('focus', reler);
    window.addEventListener('storage', reler);
    document.addEventListener('visibilitychange', oculta);
    return () => {
      clearInterval(relogio);
      window.removeEventListener('focus', reler);
      window.removeEventListener('storage', reler);
      document.removeEventListener('visibilitychange', oculta);
      useFalaAtiva.setState({ ativa: null });
    };
  }, []);

  const falas = useMemo(() => {
    if (usuarioId === null) return [];
    const rascunhos = podeAcessar(nivel, 'fichas/nova') ? lerRascunhosParaFala(usuarioId, pathname) : [];
    return gerarFalas(
      { fichas, unidades, pendencias: servidor ?? [], pendenciasCarregadas: servidor !== null && carregadoEm > 0, rascunhos },
      nivel,
    );
    // `carregadoEm`, `pathname` e `versao` são gatilhos de releitura (resposta nova, troca de tela, relógio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, nivel, fichas, unidades, servidor, carregadoEm, pathname, versao]);

  const itensAtencao = useMemo(() => itensDeAtencaoDasFalas(falas), [falas]);

  const rotaOk = rotaPermiteFala(pathname, nivel, canal);
  const candidata = useMemo(
    () => (usuarioId !== null && rotaOk
      ? decidirBalao({ falas, memoria: memoriaServico.ler(usuarioId), agora: Date.now(), silenciado, canal })
      : null),
    // `versao` re-lê a memória e o relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuarioId, rotaOk, falas, silenciado, canal, versao],
  );

  // Bloqueio ou saída da tela: a fala que está à vista sai (já contou como dita).
  useEffect(() => {
    if (bloqueado || !rotaOk || silenciado) useFalaAtiva.setState({ ativa: null });
  }, [bloqueado, rotaOk, silenciado]);

  // 1,5 s depois de tudo livre, a fala nasce.
  useEffect(() => {
    if (!candidata || usuarioId === null || bloqueado || abaOculta || useFalaAtiva.getState().ativa) return;
    const espera = setTimeout(() => {
      // Modal aberto: espera a próxima reavaliação (o relógio de 1 min).
      if (document.querySelector('[aria-modal="true"], dialog[open]')) return;
      const agora = Date.now();
      memoriaServico.registrar(usuarioId, candidata, canal, agora);
      registrarAceno([], agora); // o aceno de urgência espera o mesmo intervalo
      useFalaAtiva.setState({ ativa: candidata });
      setVersao((n) => n + 1);
    }, ATRASO_BALAO_MS);
    return () => clearTimeout(espera);
  }, [candidata, usuarioId, bloqueado, abaOculta, canal]);

  return { falas, itensAtencao };
}
