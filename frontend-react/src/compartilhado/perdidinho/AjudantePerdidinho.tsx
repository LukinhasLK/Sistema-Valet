import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icone } from '../Icone';
import { CURVA, DURACAO } from '../movimento';
import { useUsuario } from '../../nucleo/estado/auth';
import { useInterface } from '../../nucleo/estado/interface';
import { onboardingServico, progressoDe, useConvitePendente, useConviteVisivel, useOnboarding } from '../../nucleo/onboarding/estado';
import { roteiroDo } from '../../nucleo/onboarding/roteiros';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { useAvisos, useNotificacoesDisponiveis } from '../../nucleo/servicos/notificacoes';
import { useMotorDeFalas } from '../../nucleo/servicos/falas';
import { memoriaServico, useFalaAtiva } from '../../nucleo/servicos/falas-estado';
import {
  decidirAceno, humorDasPendencias, pendenciasServico, registrarAceno, resumir, silencioServico, TIPOS_PREJUIZO, usePendencias, usePresenca,
  useSilenciado, type ItemPendencia,
} from '../../nucleo/servicos/pendencias';
import { BalaoCompanheiro } from './BalaoCompanheiro';
import { ConviteNaBarra, textoDoConvite } from './ConviteNaBarra';
import { PerdidinhoTardio } from './index';
import { PainelAtencao } from './PainelAtencao';
import { useAlvoDoOlhar, type ModoOlhar } from './useAlvoDoOlhar';
import './perdidinho.scss';
import './ajudante.scss';

/** Sem interação por este tempo, o Perdidinho feliz (nada pendente) adormece. */
export const SONO_MS = 2 * 60_000;
/** Duração do aceno (uma vez). */
export const ACENO_MS = 700;
/** Aceno do convite de primeiro acesso: o "oi" inteiro (sobe, balança, pousa), depois volta ao humor normal. */
export const ACENO_CONVITE_MS = 1200;
/** Atraso do convite (igual ao `delay` do Convite do celular em TourGuiado): o aceno começa quando o convite nasce. */
export const ATRASO_CONVITE_MS = 900;

/** Transição do olhar por modo: olhadela rápida, ajuste calmo, retorno suave ao olhar livre (todas ease-out). */
const OLHAR_CSS: Record<ModoOlhar, { dur: string; atraso: string }> = {
  salto: { dur: '220ms', atraso: '0ms' },
  ajuste: { dur: '260ms', atraso: '30ms' },
  livre: { dur: '280ms', atraso: '80ms' },
};

const ROTA_QUIETA = /^\/app\/fichas\/(nova|\d+\/editar)\/?$/;
const CAMPO = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** Há um campo de digitação com o foco? (o Perdidinho não chama a atenção enquanto se digita) */
function useCampoFocado(): boolean {
  const [campo, setCampo] = useState(() => !!document.activeElement?.closest(CAMPO));
  useEffect(() => {
    const dentro = () => setCampo(!!document.activeElement?.closest(CAMPO));
    const fora = () => setCampo(false);
    document.addEventListener('focusin', dentro);
    document.addEventListener('focusout', fora);
    return () => {
      document.removeEventListener('focusin', dentro);
      document.removeEventListener('focusout', fora);
    };
  }, []);
  return campo;
}

/** Sono: depois de 2 min sem toque, mouse ou tecla. */
function useAdormecido(ativo: boolean): boolean {
  const [dormindo, setDormindo] = useState(false);
  useEffect(() => {
    if (!ativo) { setDormindo(false); return; }
    let timer = setTimeout(() => setDormindo(true), SONO_MS);
    const acordar = () => {
      setDormindo(false);
      clearTimeout(timer);
      timer = setTimeout(() => setDormindo(true), SONO_MS);
    };
    document.addEventListener('pointerdown', acordar, { passive: true });
    document.addEventListener('keydown', acordar, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', acordar);
      document.removeEventListener('keydown', acordar);
    };
  }, [ativo]);
  return dormindo;
}

/** Cubo sem olhos: o Perdidinho "de pé", quieto, quando outro Perdidinho (tela ou tour) é quem tem olhos. */
function Silhueta({ tamanho }: { tamanho: number }) {
  const id = useId();
  return (
    <pf-perdidinho aria-hidden="true" data-silhueta="">
      <svg className="perdidinho" viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
            <stop className="perdidinho__luz-a" offset="0" />
            <stop className="perdidinho__luz-b" offset="1" />
          </linearGradient>
        </defs>
        <g className="perdidinho__lado">
          {[4, 3, 2, 1, 0.5].map((d) => <rect key={d} x={6 + d} y={14 - d} width="44" height="44" rx="12" />)}
        </g>
        <rect x="6" y="14" width="44" height="44" rx="12" fill={`url(#${id}-face)`} />
        <path className="perdidinho__raio" d="M44.6 44.5 L40.4 50.2 H43.2 L41.8 55.2 L46.2 49 H43.4 Z" />
      </svg>
    </pf-perdidinho>
  );
}

const ORDEM_NIVEL: Record<ItemPendencia['nivel'], number> = { URGENTE: 0, ATENCAO: 1, INFO: 2 };

/** Faixa do celular: a fala do Perdidinho presa abaixo do cabeçalho (empurra o conteúdo, nunca flutua). Renderizada pelo LayoutApp. */
export function FaixaDeFala() {
  const ativa = useFalaAtiva((s) => s.ativa);
  const navegar = useNavigate();
  const parado = useReducedMotion() ?? false;
  const aoFechar = useCallback(() => useFalaAtiva.setState({ ativa: null }), []);
  if (!ativa) return null;
  return (
    <BalaoCompanheiro key={`${ativa.id}:${ativa.chave}`} variante="faixa" texto={ativa.texto} reduzirMovimento={parado}
      acao={ativa.acao ? { rotulo: ativa.acao.rotulo, aoClicar: () => navegar(ativa.acao!.rota) } : undefined} aoFechar={aoFechar} />
  );
}

interface Props {
  /** `barra`: botão na barra superior do desktop (com a fala à esquerda e a gaveta à direita). `topo`: botão no topo do celular, entre busca e perfil. */
  variante: 'barra' | 'topo';
  /** Desktop: a gaveta abriu ou fechou (o layout reserva espaço em telas largas). */
  aoMudarGaveta?: (aberta: boolean) => void;
}

/**
 * Perdidinho ajudante: o lugar das pendências. Desktop: botão na barra superior (mascote de 32 px em alvo de 44 px), com as
 * falas e o convite do tour DENTRO da barra e a lista numa gaveta à direita; celular: botão no topo. Humor por situação (triste sem conexão, surpreso se urgente, preocupado se há prejuízo, apontando se há o que fazer, explicando, feliz), selo com o número
 * de pendências e uma gaveta/folha "Precisa da sua atenção". No desktop o olhar acompanha onde a pessoa age (foco/clique) e
 * os olhos se fecham em campo de senha. Nunca é modal sozinho, não faz som e só acena uma vez por pendência urgente.
 */
export function AjudantePerdidinho({ variante, aoMudarGaveta }: Props) {
  const { pathname } = useLocation();
  const usuario = useUsuario();
  const { itens: itensServidor, carregadoEm, falhou } = usePendencias(pathname);
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [acenando, setAcenando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const botao = useRef<HTMLButtonElement>(null);
  const mascote = useRef<HTMLSpanElement>(null);
  const idPainel = useId();
  const parado = useReducedMotion() ?? false;
  const barra = variante === 'barra';
  const comPresenca = usePresenca((s) => s.total > 0);
  const tourAtivo = useOnboarding((s) => s.ativo !== null);
  const conviteAberto = useConviteVisivel(usuario?.id);
  const convitePendente = useConvitePendente(usuario?.id);
  const conviteRetomada = useOnboarding((s) => { const st = progressoDe(s.progresso, usuario?.id).status; return st === 'pausado' || st === 'em_andamento'; });
  const paletaAberta = useInterface((s) => s.paletaAberta);
  const silenciado = useSilenciado();
  const campoFocado = useCampoFocado();
  const avisosDisponiveis = useNotificacoesDisponiveis();
  const avisos = useAvisos(aberto);
  const naoLidas = avisos.total ?? 0;
  // Falas do Perdidinho (na barra no desktop, faixa no celular): só em momento livre, uma por vez.
  const bloqueadoParaFala = campoFocado || tourAtivo || conviteAberto || convitePendente || paletaAberta || aberto || comPresenca;
  const { falas, itensAtencao } = useMotorDeFalas({ canal: barra ? 'balao' : 'faixa', pathname, bloqueado: bloqueadoParaFala });
  const falaAtiva = useFalaAtiva((s) => s.ativa);
  const itens = useMemo(
    () => (itensAtencao.length ? [...itensServidor, ...itensAtencao].sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel]) : itensServidor),
    [itensServidor, itensAtencao],
  );
  const resumo = useMemo(() => resumir(itens), [itens]);
  const aoFecharFala = useCallback(() => useFalaAtiva.setState({ ativa: null }), []);
  const dormindo = useAdormecido(resumo.nivel === 'nada' && !falhou);
  // O convite de primeiro acesso é anunciado por este próprio Perdidinho (ele acena), no desktop e no celular.
  const semOlhos = comPresenca || tourAtivo;
  const { olhar: alvoOlhar, senha, modo, saltos } = useAlvoDoOlhar(mascote, barra && !parado && !semOlhos);
  const timerAceno = useRef<ReturnType<typeof setTimeout>>();
  const anteriorUrgentes = useRef<number | null>(null);

  useEffect(() => () => clearTimeout(timerAceno.current), []);

  // O layout reserva espaço para a gaveta em telas largas; ao desmontar (ou virar celular), devolve.
  const aoMudarGavetaAtual = useRef(aoMudarGaveta);
  aoMudarGavetaAtual.current = aoMudarGaveta;
  useEffect(() => {
    if (!barra) return;
    aoMudarGavetaAtual.current?.(aberto);
    return () => aoMudarGavetaAtual.current?.(false);
  }, [barra, aberto]);

  // Fala na barra: o mascote dá um pulinho (4 px, 180 ms) e olha para ela (à esquerda) por um instante.
  const [olhaFala, setOlhaFala] = useState(false);
  const chaveFala = barra && falaAtiva ? `${falaAtiva.id}:${falaAtiva.chave}` : null;
  const chamando = chaveFala !== null || (barra && conviteAberto);
  useEffect(() => {
    if (!chamando || parado || semOlhos) return;
    const atraso = chaveFala === null ? ATRASO_CONVITE_MS : 0;
    let fim: ReturnType<typeof setTimeout> | undefined;
    let pulo: Animation | undefined;
    const inicio = setTimeout(() => {
      setOlhaFala(true);
      fim = setTimeout(() => setOlhaFala(false), 1800);
      const el = botao.current;
      if (el && typeof el.animate === 'function') {
        pulo = el.animate([{ transform: 'none' }, { transform: 'translateY(-4px)', offset: 0.45 }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }
    }, atraso);
    return () => {
      clearTimeout(inicio);
      clearTimeout(fim);
      pulo?.cancel();
      setOlhaFala(false);
    };
  }, [chamando, chaveFala, parado, semOlhos]);

  // Região viva ÚNICA da barra: a fala (ou o convite) é anunciada aqui, sem região própria no balão (nada de anúncio duplo).
  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';
  const textoConvite = barra && conviteAberto ? textoDoConvite(primeiroNome, conviteRetomada) : null;
  const textoFala = barra ? (falaAtiva?.texto ?? textoConvite) : null;
  useEffect(() => {
    if (!barra) return;
    if (textoFala === null) { setAnuncio(''); return; }
    const t = setTimeout(() => setAnuncio(textoFala), falaAtiva ? 50 : ATRASO_CONVITE_MS);
    return () => clearTimeout(t);
  }, [barra, textoFala, falaAtiva]);

  // Olhadela: ao mudar de região, o corpo "repara" (inclina ~2° e chega 1 px para o lado do alvo) e volta.
  // WAAPI só com transform, numa camada própria (o GSAP do Perdidinho anima os elementos de dentro).
  const olharRef = useRef(alvoOlhar);
  olharRef.current = alvoOlhar;
  useEffect(() => {
    const el = mascote.current;
    const d = olharRef.current;
    if (!saltos || !el || !d || typeof el.animate !== 'function') return;
    const pose = `translate(${(d.x * 1.4).toFixed(2)}px, ${(d.y * 1).toFixed(2)}px) rotate(${(d.x * 2.6).toFixed(2)}deg)`;
    const anim = el.animate(
      [{ transform: 'none' }, { transform: pose, offset: 0.4 }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
    return () => anim.cancel();
  }, [saltos]);

  // Convite de primeiro acesso (desktop e celular): UM aceno quando o balão nasce, depois o humor normal.
  const [acenoConvite, setAcenoConvite] = useState(false);
  useEffect(() => {
    if (!conviteAberto || parado || semOlhos) return;
    let fim: ReturnType<typeof setTimeout> | undefined;
    const inicio = setTimeout(() => {
      setAcenoConvite(true);
      fim = setTimeout(() => setAcenoConvite(false), ACENO_CONVITE_MS);
    }, ATRASO_CONVITE_MS);
    return () => {
      clearTimeout(inicio);
      clearTimeout(fim);
      setAcenoConvite(false);
    };
  }, [conviteAberto, parado, semOlhos]);

  // Aceno: uma vez por pendência urgente (ou alerta de prejuízo do painel) nova, com 10 min de intervalo, fora dos momentos quietos.
  useEffect(() => {
    if (parado || semOlhos || convitePendente || !usuario) return;
    const urgentes = itens.filter((i) => i.nivel === 'URGENTE' || TIPOS_PREJUIZO.includes(i.tipo)).map((i) => i.id);
    if (!urgentes.length) return;
    const quieto = campoFocado || tourAtivo || paletaAberta || aberto || ROTA_QUIETA.test(pathname)
      || !!document.querySelector('[aria-modal="true"], dialog[open]');
    const novos = decidirAceno({ urgentes, silenciado, quieto });
    if (!novos.length) return;
    registrarAceno(novos);
    memoriaServico.marcarAceno(usuario.id); // o aceno entra no intervalo de 15 min dos balões
    setAcenando(true);
    clearTimeout(timerAceno.current);
    timerAceno.current = setTimeout(() => setAcenando(false), ACENO_MS);
  }, [itens, carregadoEm, silenciado, campoFocado, tourAtivo, paletaAberta, aberto, pathname, parado, semOlhos, convitePendente, usuario]);

  // Notificação nova: um pulinho e "Novo aviso: ..." na região viva, uma vez por notificação. Não conta na cota de falas.
  // Silenciar corta pulinho e anúncio (o pontinho continua); campo focado, tour, paleta, painel aberto e diálogos também.
  const ultimaNova = useRef<number | null>(null);
  const novaDeAviso = avisos.nova;
  useEffect(() => {
    if (!novaDeAviso || ultimaNova.current === novaDeAviso.id) return;
    ultimaNova.current = novaDeAviso.id;
    const quieto = silenciado || semOlhos || convitePendente || campoFocado || tourAtivo || paletaAberta || aberto || ROTA_QUIETA.test(pathname)
      || !!document.querySelector('[aria-modal="true"], dialog[open]');
    if (quieto) return;
    const curto = novaDeAviso.titulo.length > 70 ? `${novaDeAviso.titulo.slice(0, 69).trimEnd()}…` : novaDeAviso.titulo;
    setAnuncio(`Novo aviso: ${curto}`);
    const el = botao.current;
    if (!parado && el && typeof el.animate === 'function') {
      el.animate([{ transform: 'none' }, { transform: 'translateY(-4px)', offset: 0.45 }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
  }, [novaDeAviso, silenciado, semOlhos, convitePendente, campoFocado, tourAtivo, paletaAberta, aberto, pathname, parado]);

  // Anúncio para leitor de tela: só quando o total de urgentes AUMENTA (inclusive ao entrar na sessão).
  useEffect(() => {
    if (anteriorUrgentes.current === null) {
      if (!carregadoEm) return;
      anteriorUrgentes.current = 0;
    }
    const antes = anteriorUrgentes.current;
    anteriorUrgentes.current = resumo.urgentes;
    if (resumo.urgentes > antes) {
      const primeira = itens.find((i) => i.nivel === 'URGENTE');
      setAnuncio(`Pendência urgente: ${primeira?.texto ?? 'veja o painel de atenção.'}`);
    } else if (resumo.urgentes === 0) setAnuncio('');
  }, [resumo.urgentes, itens, carregadoEm]);

  function abrir() {
    setAberto(true);
    void pendenciasServico.atualizar(true);
  }

  function fechar(devolverFoco = false) {
    setAberto(false);
    if (devolverFoco) requestAnimationFrame(() => botao.current?.focus({ preventScroll: true }));
  }

  if (!usuario) return null;

  const humor: HumorMascote = acenoConvite || acenando ? 'acenando' : barra && falaAtiva ? falaAtiva.humor : resumo.nivel === 'nada' && !falhou && dormindo ? 'dormindo' : humorDasPendencias(resumo, falhou);
  const mostraNumero = resumo.contador > 0;
  const mostraAviso = avisosDisponiveis && naoLidas > 0;
  const rotuloDoBotao = mostraAviso ? `${resumo.rotulo}, ${naoLidas} ${naoLidas === 1 ? 'aviso novo' : 'avisos novos'}` : resumo.rotulo;
  // O pontinho de avisos fica no canto oposto ao selo; sem selo nem ponto de "para saber", ocupa o lugar do selo.
  const cantoAviso = mostraNumero || resumo.nivel === 'info' ? 'oposto' : 'selo';
  const urgente = resumo.nivel === 'urgente';
  const temTour = roteiroDo(usuario.nivel).length > 0;
  const tamanho = barra ? 32 : 28;
  // Olhar: desktop acompanha a ação (sem ação, livre = segue o cursor); movimento reduzido ou celular: neutro e fixo.
  const olhar = barra && !parado ? (olhaFala ? { x: -0.7, y: 0.05 } : alvoOlhar) : { x: 0, y: 0 };
  const olharCss = OLHAR_CSS[modo];

  return (
    <pf-ajudante-perdidinho data-variante={variante} data-nivel={resumo.nivel}
      data-aberto={aberto || undefined} data-sem-olhos={semOlhos || undefined}>
      {/* Fala e convite: DENTRO da barra, antes do botão (o indicador da fala aponta para o mascote). */}
      {barra && falaAtiva && (
        <BalaoCompanheiro key={`${falaAtiva.id}:${falaAtiva.chave}`} variante="barra" texto={falaAtiva.texto} reduzirMovimento={parado}
          acao={falaAtiva.acao ? { rotulo: falaAtiva.acao.rotulo, aoClicar: () => navegar(falaAtiva.acao!.rota) } : undefined}
          aoFechar={aoFecharFala} />
      )}
      {barra && <AnimatePresence>{conviteAberto && <ConviteNaBarra key="convite" atrasoMs={parado ? 0 : ATRASO_CONVITE_MS} reduzirMovimento={parado} />}</AnimatePresence>}
        <button ref={botao} type="button" className="ajud__botao" aria-label={rotuloDoBotao} aria-haspopup="dialog"
          aria-expanded={aberto} aria-controls={aberto ? idPainel : undefined} data-tour="ajudante"
          onClick={() => {
            // Convite recolhido (desktop): o primeiro clique o reabre; com ele à vista, o clique abre a gaveta como sempre.
            if (barra && convitePendente && !conviteAberto && !aberto) onboardingServico.recolherConvite(false);
            else if (aberto) fechar();
            else abrir();
          }}>
          <span ref={mascote} className="ajud__mascote" aria-hidden="true" style={{
            '--ajud-tamanho': `${tamanho}px`, '--perdidinho-olhar-dur': olharCss.dur, '--perdidinho-olhar-atraso': olharCss.atraso,
          } as CSSProperties}>
            {semOlhos
              ? <Silhueta tamanho={tamanho} />
              : <PerdidinhoTardio decorativo tamanho={tamanho} humor={humor} falando={false} passo={`ajudante-${humor}`} lado="centro"
                  olhar={olhar} olhos={barra && senha ? 'fechados' : undefined} ciclos={false} reduzirMovimento={parado} />}
          </span>
          {mostraNumero && (
            // A chave é o número: o selo só "brota" quando o número muda (nunca em laço).
            <motion.span key={resumo.contador} className="ajud__selo" aria-hidden="true" data-nivel={resumo.nivel}
              initial={{ scale: parado ? 1 : 0.6 }} animate={{ scale: 1 }} transition={{ duration: DURACAO.rapida, ease: CURVA.saida }}>
              {urgente && <Icone nome="alerta" tamanho={11} />}
              {resumo.contador > 99 ? '99+' : resumo.contador}
            </motion.span>
          )}
          {!mostraNumero && resumo.nivel === 'info' && <span className="ajud__ponto" aria-hidden="true" />}
          {mostraAviso && <span className="ajud__aviso" data-canto={cantoAviso} aria-hidden="true" />}
        </button>
      {/* Região viva: o aumento de urgentes e, na barra, a fala/convite (a faixa do celular tem a própria, no LayoutApp). */}
      <div className="ajud__anuncio" role="status" aria-live="polite" aria-atomic="true">{anuncio}</div>
      {createPortal(
        <AnimatePresence>
          {aberto && (
            <PainelAtencao key="painel" id={idPainel} variante={barra ? 'gaveta' : 'folha'} itens={itens}
              botao={botao} falas={falas.filter((f) => f.noPainel)} avisos={avisosDisponiveis ? avisos : null} silenciado={silenciado} temTour={temTour} comPendencia={mostraNumero}
              aoFechar={fechar}
              aoSilenciar={() => { silencioServico.silenciar(usuario.id); fechar(true); }}
              aoVoltarAvisar={() => silencioServico.voltar(usuario.id)}
              aoReverTour={() => { fechar(); onboardingServico.iniciar(usuario.id, usuario.nivel); }} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </pf-ajudante-perdidinho>
  );
}
