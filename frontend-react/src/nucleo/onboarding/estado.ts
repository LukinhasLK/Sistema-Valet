import { create } from 'zustand';
import { NivelAcesso } from '../modelos';
import { carregar, salvar } from '../servicos/storage';
import { PassoTour, roteiroDo, VERSAO_ROTEIRO } from './roteiros';

/**
 * Progresso do onboarding, por usuário e por aparelho (localStorage).
 * Guardar no servidor exigiria um endpoint novo no back end — ver o relatório.
 */
export type StatusTour = 'nao_iniciado' | 'em_andamento' | 'pausado' | 'concluido' | 'pulado';

export interface ProgressoTour {
  versao: number;
  status: StatusTour;
  passo: number;
  atualizadoEm: string;
  dicasVistas: string[];
}

const CHAVE = 'parkflash.onboarding';
/** "Lembrar depois" vale para a sessão do navegador inteira (sobrevive a recarregar a página). */
const CHAVE_ADIADO = 'parkflash.v3.conviteAdiado';

function lerAdiado(): boolean {
  try { return sessionStorage.getItem(CHAVE_ADIADO) === '1'; } catch { return false; }
}
function definirAdiado(valor: boolean): void {
  try { if (valor) sessionStorage.setItem(CHAVE_ADIADO, '1'); else sessionStorage.removeItem(CHAVE_ADIADO); } catch { /* ignora */ }
  useOnboarding.setState({ conviteAdiado: valor });
}

type Mapa = Record<string, ProgressoTour>;

interface EstadoOnboarding {
  progresso: Mapa;
  /** Tour em exibição agora. */
  ativo: { usuario: number; roteiro: PassoTour[]; indice: number } | null;
  /** Convite de boas-vindas dispensado nesta sessão ("lembrar depois"). */
  conviteAdiado: boolean;
  /** Desktop: o convite recolheu para o Perdidinho (sem interação por um tempo); clicar nele reabre. */
  conviteRecolhido: boolean;
}

const novo = (): ProgressoTour => ({ versao: VERSAO_ROTEIRO, status: 'nao_iniciado', passo: 0, atualizadoEm: new Date().toISOString(), dicasVistas: [] });

export const useOnboarding = create<EstadoOnboarding>(() => ({
  progresso: carregar<Mapa>(CHAVE, {}),
  ativo: null,
  conviteAdiado: lerAdiado(),
  conviteRecolhido: false,
}));

function gravar(usuario: number, alteracao: Partial<ProgressoTour>): void {
  const atual = useOnboarding.getState().progresso[usuario] ?? novo();
  const progresso = { ...useOnboarding.getState().progresso, [usuario]: { ...atual, ...alteracao, atualizadoEm: new Date().toISOString() } };
  useOnboarding.setState({ progresso });
  salvar(CHAVE, progresso);
}

/** Progresso do usuário; roteiro de versão antiga conta como não iniciado (mantendo as dicas vistas). */
export function progressoDe(mapa: Mapa, usuario: number | undefined): ProgressoTour {
  if (usuario === undefined) return novo();
  const p = mapa[usuario];
  if (!p) return novo();
  if (p.versao !== VERSAO_ROTEIRO && (p.status === 'concluido' || p.status === 'pulado')) return { ...novo(), dicasVistas: p.dicasVistas };
  return p;
}

/** O convite de primeiro acesso (ou de continuar o tour) está à vista? Quem o mostra e quem "fala" por ele usam a mesma regra. */
export function useConvitePendente(usuario: number | undefined): boolean {
  const ativo = useOnboarding((s) => s.ativo);
  const adiado = useOnboarding((s) => s.conviteAdiado);
  const status = useOnboarding((s) => progressoDe(s.progresso, usuario).status);
  return usuario !== undefined && !ativo && !adiado && (status === 'nao_iniciado' || status === 'pausado' || status === 'em_andamento');
}

/** Convite pendente e aberto (não recolhido para o Perdidinho). */
export function useConviteVisivel(usuario: number | undefined): boolean {
  const pendente = useConvitePendente(usuario);
  const recolhido = useOnboarding((s) => s.conviteRecolhido);
  return pendente && !recolhido;
}

export const onboardingServico = {
  /** Começa (ou recomeça do zero) o tour do nível. */
  iniciar(usuario: number | undefined, nivel: NivelAcesso | null) {
    if (usuario === undefined) return;
    const roteiro = roteiroDo(nivel);
    gravar(usuario, { status: 'em_andamento', passo: 0, versao: VERSAO_ROTEIRO });
    useOnboarding.setState({ ativo: { usuario, roteiro, indice: 0 } });
    definirAdiado(true);
  },

  /** Continua de onde parou ("continuar depois"). */
  retomar(usuario: number | undefined, nivel: NivelAcesso | null) {
    if (usuario === undefined) return;
    const roteiro = roteiroDo(nivel);
    const p = progressoDe(useOnboarding.getState().progresso, usuario);
    const indice = Math.min(p.passo, roteiro.length - 1);
    gravar(usuario, { status: 'em_andamento', passo: indice });
    useOnboarding.setState({ ativo: { usuario, roteiro, indice } });
    definirAdiado(true);
  },

  irPara(indice: number) {
    const ativo = useOnboarding.getState().ativo;
    if (!ativo) return;
    const limite = Math.max(0, Math.min(indice, ativo.roteiro.length - 1));
    gravar(ativo.usuario, { passo: limite });
    useOnboarding.setState({ ativo: { ...ativo, indice: limite } });
  },

  avancar() {
    const ativo = useOnboarding.getState().ativo;
    if (!ativo) return;
    if (ativo.indice >= ativo.roteiro.length - 1) onboardingServico.concluir();
    else onboardingServico.irPara(ativo.indice + 1);
  },

  voltar() {
    const ativo = useOnboarding.getState().ativo;
    if (ativo) onboardingServico.irPara(ativo.indice - 1);
  },

  /** Fecha guardando o passo atual. */
  pausar() {
    const ativo = useOnboarding.getState().ativo;
    if (!ativo) return;
    gravar(ativo.usuario, { status: 'pausado', passo: ativo.indice });
    // O convite para continuar só volta na próxima sessão (ou pelo perfil / paleta).
    useOnboarding.setState({ ativo: null });
    definirAdiado(true);
  },

  pular(usuario?: number) {
    const alvo = usuario ?? useOnboarding.getState().ativo?.usuario;
    if (alvo === undefined) return;
    gravar(alvo, { status: 'pulado' });
    useOnboarding.setState({ ativo: null });
    definirAdiado(true);
  },

  concluir() {
    const ativo = useOnboarding.getState().ativo;
    if (!ativo) return;
    gravar(ativo.usuario, { status: 'concluido', passo: ativo.roteiro.length - 1 });
    useOnboarding.setState({ ativo: null });
  },

  /** "Lembrar depois": esconde o convite só nesta sessão. */
  adiarConvite() {
    definirAdiado(true);
  },

  /** Desktop: recolhe o convite para o Perdidinho (continua pendente) ou o reabre. */
  recolherConvite(recolhido: boolean) {
    useOnboarding.setState({ conviteRecolhido: recolhido });
  },

  marcarDica(usuario: number | undefined, dica: string) {
    if (usuario === undefined) return;
    const p = progressoDe(useOnboarding.getState().progresso, usuario);
    if (!p.dicasVistas.includes(dica)) gravar(usuario, { dicasVistas: [...p.dicasVistas, dica] });
  },

  /** Ao sair da conta: o tour em exibição é pausado (o progresso fica salvo). */
  encerrarSessao() {
    if (useOnboarding.getState().ativo) onboardingServico.pausar();
    definirAdiado(false);
    useOnboarding.setState({ conviteRecolhido: false });
  },
};
