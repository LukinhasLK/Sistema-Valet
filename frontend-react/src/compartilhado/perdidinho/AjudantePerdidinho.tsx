import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Dica } from '../Dica';
import { Icone } from '../Icone';
import { CURVA, DURACAO } from '../movimento';
import { useUsuario } from '../../nucleo/estado/auth';
import { useInterface } from '../../nucleo/estado/interface';
import { onboardingServico, useConviteVisivel, useOnboarding } from '../../nucleo/onboarding/estado';
import { roteiroDo } from '../../nucleo/onboarding/roteiros';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import {
  decidirAceno, pendenciasServico, registrarAceno, silencioServico, usePendencias, usePresenca, useSilenciado,
  type NivelGeral,
} from '../../nucleo/servicos/pendencias';
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
/** Atraso do balão do convite (igual ao `delay` do Convite em TourGuiado): o aceno começa quando o balão nasce. */
export const ATRASO_CONVITE_MS = 900;

/** Transição do olhar por modo: olhadela rápida, ajuste calmo, retorno suave ao olhar livre (todas ease-out). */
const OLHAR_CSS: Record<ModoOlhar, { dur: string; atraso: string }> = {
  salto: { dur: '220ms', atraso: '0ms' },
  ajuste: { dur: '260ms', atraso: '30ms' },
  livre: { dur: '280ms', atraso: '80ms' },
};

/** Entrada do companheiro: só a primeira vez que ele aparece para cada usuário nesta carga da página. */
let entrouPara: number | null = null;

const HUMOR_DO_NIVEL: Record<NivelGeral, HumorMascote> = { nada: 'feliz', info: 'explicando', atencao: 'pensando', urgente: 'surpreso' };
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

interface Props {
  /** `lado`: companheiro fixo no canto inferior direito (desktop). `topo`: botão no topo do celular, entre busca e sino. */
  variante: 'lado' | 'topo';
}

/**
 * Perdidinho ajudante: o lugar das pendências. Desktop: companheiro fixo no canto inferior direito (mascote de 48 px);
 * celular: botão no topo. Humor conforme o nível mais alto (feliz, explicando, pensando, surpreso), selo com o número
 * de pendências e um painel "Precisa da sua atenção". No desktop o olhar acompanha onde a pessoa age (foco/clique) e
 * os olhos se fecham em campo de senha. Nunca é modal sozinho, não faz som e só acena uma vez por pendência urgente.
 */
export function AjudantePerdidinho({ variante }: Props) {
  const { pathname } = useLocation();
  const usuario = useUsuario();
  const { itens, resumo, carregadoEm } = usePendencias(pathname);
  const [aberto, setAberto] = useState(false);
  const [acenando, setAcenando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const botao = useRef<HTMLButtonElement>(null);
  const mascote = useRef<HTMLSpanElement>(null);
  const idPainel = useId();
  const parado = useReducedMotion() ?? false;
  const lado = variante === 'lado';
  const comPresenca = usePresenca((s) => s.total > 0);
  const tourAtivo = useOnboarding((s) => s.ativo !== null);
  const conviteAberto = useConviteVisivel(usuario?.id);
  const paletaAberta = useInterface((s) => s.paletaAberta);
  const silenciado = useSilenciado();
  const campoFocado = useCampoFocado();
  const dormindo = useAdormecido(resumo.nivel === 'nada');
  // No desktop o convite sai deste próprio Perdidinho (ele acena); no celular quem acena é o do cartão (presença) e este vira silhueta.
  const semOlhos = comPresenca || tourAtivo;
  const { olhar: alvoOlhar, senha, modo, saltos } = useAlvoDoOlhar(mascote, lado && !parado && !semOlhos);
  const timerAceno = useRef<ReturnType<typeof setTimeout>>();
  const anteriorUrgentes = useRef<number | null>(null);
  // Entrada: trava na primeira pintura com usuário (o atributo fica, a animação CSS roda uma vez só).
  const entradaDe = useRef<number | null>(null);
  if (lado && usuario && entradaDe.current === null && entrouPara !== usuario.id) entradaDe.current = usuario.id;
  const entrando = entradaDe.current !== null && entradaDe.current === usuario?.id;

  useEffect(() => () => clearTimeout(timerAceno.current), []);

  useEffect(() => {
    if (entradaDe.current !== null) entrouPara = entradaDe.current;
  }, [usuario]);

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

  // Convite de primeiro acesso (desktop): UM aceno quando o balão nasce, depois o humor normal.
  const [acenoConvite, setAcenoConvite] = useState(false);
  useEffect(() => {
    if (!lado || !conviteAberto || parado || semOlhos) return;
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
  }, [lado, conviteAberto, parado, semOlhos]);

  // Aceno: uma vez por pendência urgente nova, com 10 min de intervalo, fora dos momentos quietos.
  useEffect(() => {
    if (parado || semOlhos || conviteAberto || !usuario) return;
    const urgentes = itens.filter((i) => i.nivel === 'URGENTE').map((i) => i.id);
    if (!urgentes.length) return;
    const quieto = campoFocado || tourAtivo || paletaAberta || aberto || ROTA_QUIETA.test(pathname)
      || !!document.querySelector('[aria-modal="true"], dialog[open]');
    const novos = decidirAceno({ urgentes, silenciado, quieto });
    if (!novos.length) return;
    registrarAceno(novos);
    setAcenando(true);
    clearTimeout(timerAceno.current);
    timerAceno.current = setTimeout(() => setAcenando(false), ACENO_MS);
  }, [itens, carregadoEm, silenciado, campoFocado, tourAtivo, paletaAberta, aberto, pathname, parado, semOlhos, conviteAberto, usuario]);

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

  const humor: HumorMascote = acenoConvite || acenando ? 'acenando' : resumo.nivel === 'nada' && dormindo ? 'dormindo' : HUMOR_DO_NIVEL[resumo.nivel];
  const mostraNumero = resumo.contador > 0;
  const urgente = resumo.nivel === 'urgente';
  const temTour = roteiroDo(usuario.nivel).length > 0;
  const tamanho = lado ? 48 : 28;
  // Olhar: desktop acompanha a ação (sem ação, livre = segue o cursor); movimento reduzido ou celular: neutro e fixo.
  const olhar = lado && !parado ? alvoOlhar : { x: 0, y: 0 };
  const olharCss = OLHAR_CSS[modo];

  return (
    <pf-ajudante-perdidinho data-variante={variante} data-nivel={resumo.nivel}
      data-aberto={aberto || undefined} data-sem-olhos={semOlhos || undefined} data-entrada={entrando || undefined}>
      <Dica texto="Precisa da sua atenção" lado={lado ? 'left' : 'bottom'} desligada={!lado}>
        <button ref={botao} type="button" className="ajud__botao" aria-label={resumo.rotulo} aria-haspopup="dialog"
          aria-expanded={aberto} aria-controls={aberto ? idPainel : undefined} data-tour="ajudante"
          onClick={() => (aberto ? fechar() : abrir())}>
          <span ref={mascote} className="ajud__mascote" aria-hidden="true" style={{
            '--ajud-tamanho': `${tamanho}px`, '--perdidinho-olhar-dur': olharCss.dur, '--perdidinho-olhar-atraso': olharCss.atraso,
          } as CSSProperties}>
            {semOlhos
              ? <Silhueta tamanho={tamanho} />
              : <PerdidinhoTardio decorativo tamanho={tamanho} humor={humor} falando={false} passo={`ajudante-${humor}`} lado="centro"
                  olhar={olhar} olhos={lado && senha ? 'fechados' : undefined} ciclos={false} reduzirMovimento={parado} />}
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
        </button>
      </Dica>
      {/* Região viva: só o aumento de urgentes é anunciado. */}
      <div className="ajud__anuncio" role="status" aria-live="polite" aria-atomic="true">{anuncio}</div>
      {createPortal(
        <AnimatePresence>
          {aberto && (
            <PainelAtencao key="painel" id={idPainel} variante={lado ? 'desktop' : 'folha'} itens={itens}
              botao={botao} silenciado={silenciado} temTour={temTour} comPendencia={mostraNumero}
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
