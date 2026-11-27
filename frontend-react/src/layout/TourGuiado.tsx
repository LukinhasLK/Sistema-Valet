import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icone } from '../compartilhado/Icone';
import { CURVA, TRANSICAO } from '../compartilhado/movimento';
import { ATRASO_CONVITE_MS } from '../compartilhado/perdidinho/AjudantePerdidinho';
import { useNivel, useUsuario } from '../nucleo/estado/auth';
import { useIsMobile } from '../nucleo/estado/layout';
import { onboardingServico, progressoDe, useConviteVisivel, useOnboarding } from '../nucleo/onboarding/estado';
import { useMascote } from '../nucleo/onboarding/mascote';
import { DICAS_CONTEXTUAIS } from '../nucleo/onboarding/roteiros';
import './tour-guiado.scss';

interface Caixa { left: number; top: number; width: number; height: number }

const FOLGA = 6;
/** Desktop: o convite recolhe para o Perdidinho depois de tanto tempo sem interação. */
const RECOLHER_CONVITE_MS = 12000;

/** Primeiro elemento visível com o `data-tour` pedido (o celular e o desktop têm alvos diferentes). */
function acharAlvo(alvo: string | undefined): HTMLElement | null {
  if (!alvo) return null;
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`)].find((el) => el.getClientRects().length > 0) ?? null;
}

function Tour() {
  const ativo = useOnboarding((s) => s.ativo)!;
  const passo = ativo.roteiro[ativo.indice];
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const reduzir = useReducedMotion() ?? false;
  const Mascote = useMascote((s) => s.componente);
  const cartao = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [posCartao, setPosCartao] = useState<{ left: number; top: number } | null>(null);
  const total = ativo.roteiro.length;
  const ultimo = ativo.indice === total - 1;

  // Leva à tela do passo.
  useEffect(() => {
    if (passo.rota && pathname !== passo.rota) navegar(passo.rota);
  }, [passo, pathname, navegar]);

  const medir = useCallback(() => {
    const el = acharAlvo(passo.alvo);
    if (!el) { setCaixa(null); return; }
    const r = el.getBoundingClientRect();
    setCaixa({ left: r.left - FOLGA, top: r.top - FOLGA, width: r.width + FOLGA * 2, height: r.height + FOLGA * 2 });
  }, [passo]);

  // Procura o alvo (a tela pode ainda estar carregando) e acompanha rolagem/redimensionamento.
  useEffect(() => {
    let tentativas = 0;
    let timer: ReturnType<typeof setTimeout>;
    const procurar = () => {
      const el = acharAlvo(passo.alvo);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: reduzir ? 'auto' : 'smooth' });
        timer = setTimeout(medir, reduzir ? 0 : 280);
      } else if (passo.alvo && tentativas++ < 12) {
        timer = setTimeout(procurar, 120);
      } else {
        setCaixa(null);
      }
    };
    procurar();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [passo, pathname, medir, reduzir]);

  // Posição do cartão junto ao destaque (no celular, sempre embaixo).
  useLayoutEffect(() => {
    const c = cartao.current;
    if (!c || isMobile) { setPosCartao(null); return; }
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    if (!caixa) { setPosCartao({ left: innerWidth / 2 - w / 2, top: innerHeight / 2 - h / 2 }); return; }
    const m = 14;
    const lado = passo.lado ?? 'bottom';
    let left = caixa.left;
    let top = caixa.top + caixa.height + m;
    if (lado === 'right') { left = caixa.left + caixa.width + m; top = caixa.top; }
    if (lado === 'left') { left = caixa.left - w - m; top = caixa.top; }
    if (lado === 'top') { top = caixa.top - h - m; }
    if (top + h > innerHeight - 10) top = Math.max(10, caixa.top - h - m);
    if (top < 10) top = Math.min(innerHeight - h - 10, caixa.top + caixa.height + m);
    setPosCartao({ left: Math.max(10, Math.min(left, innerWidth - w - 10)), top: Math.max(10, Math.min(top, innerHeight - h - 10)) });
  }, [caixa, passo, isMobile]);

  // Foco no cartão a cada passo (leitores de tela anunciam o novo conteúdo).
  useEffect(() => { cartao.current?.focus({ preventScroll: true }); }, [ativo.indice]);

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); onboardingServico.avancar(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onboardingServico.voltar(); }
    if (e.key === 'Escape') { e.preventDefault(); onboardingServico.pausar(); }
  }

  const sombra = 'rgba(16, 40, 63, .52)';
  return (
    <div className="tour" onKeyDown={aoTeclar}>
      {/* Véu com recorte no elemento destacado. */}
      <motion.div className="tour__veu" aria-hidden="true"
        initial={false}
        animate={caixa
          ? { left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height, borderRadius: 12, boxShadow: `0 0 0 9999px ${sombra}` }
          : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, borderRadius: 12, boxShadow: `0 0 0 9999px ${sombra}` }}
        transition={reduzir ? { duration: 0 } : TRANSICAO.molaSuave} />
      {caixa && <motion.div className="tour__anel" aria-hidden="true" style={{ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={TRANSICAO.base} />}

      <motion.div
        ref={cartao}
        key={passo.id}
        className={`tour__cartao${isMobile ? ' tour__cartao--mobile' : ''}`}
        style={posCartao ? { left: posCartao.left, top: posCartao.top } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        tabIndex={-1}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={TRANSICAO.mola}
      >
        <div className="tour__topo">
          {/* Dentro do cartão: o Perdidinho nunca sai da tela nem cobre o menu ou o item destacado. */}
          {Mascote && (
            <div className="tour__mascote">
              <Mascote humor={passo.humor ?? 'explicando'} falando passo={passo.id} lado={caixa ? passo.lado ?? 'bottom' : 'centro'} reduzirMovimento={reduzir} />
            </div>
          )}
          <span className="tour__passo">Passo {ativo.indice + 1} de {total}</span>
          <button type="button" className="tour__fechar" onClick={onboardingServico.pausar} aria-label="Fechar e continuar depois" title="Continuar depois (Esc)">
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
        <h2 id="tour-titulo" className="tour__titulo">{passo.titulo}</h2>
        <p id="tour-texto" className="tour__texto">{passo.texto}</p>
        <div className="tour__progresso" aria-hidden="true">
          {ativo.roteiro.map((p, i) => <span key={p.id} className={i <= ativo.indice ? 'feito' : ''} />)}
        </div>
        <div className="tour__acoes">
          <button type="button" className="pf-link-btn tour__pular" onClick={() => onboardingServico.pular()}>Pular tour</button>
          <span className="tour__espaco" />
          {ativo.indice > 0 && <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={onboardingServico.voltar}>Voltar</button>}
          <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={onboardingServico.avancar}>
            {ultimo ? 'Concluir' : 'Próximo'}
            {!ultimo && <Icone nome="seta" tamanho={15} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Celular: um Perdidinho pequeno no lugar do ícone (o do topo vira silhueta enquanto ele está à vista). */
/**
 * Convite discreto no primeiro acesso (ou para continuar um tour pausado). Não bloqueia a tela nem toma o foco.
 * Desktop: é um balão que sai do Perdidinho do canto inferior direito (ele acena enquanto o convite está aberto).
 * Celular: cartão na posição de sempre; quem acena é o Perdidinho do topo (um só, com olhos).
 */
function Convite() {
  const usuario = useUsuario();
  const nivel = useNivel();
  const isMobile = useIsMobile();
  const reduzir = useReducedMotion() ?? false;
  const progresso = useOnboarding((s) => progressoDe(s.progresso, usuario?.id));
  const pausado = progresso.status === 'pausado' || progresso.status === 'em_andamento';
  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';
  const aside = useRef<HTMLElement>(null);

  // Desktop: enquanto aberto, a área de conteúdo reserva a altura do balão (dá para rolar além dele)...
  useEffect(() => {
    const el = aside.current;
    if (isMobile || !el) return;
    const raiz = document.documentElement;
    const aplicar = () => raiz.style.setProperty('--pf-convite-reserva', `${el.offsetHeight + 12}px`);
    aplicar();
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(aplicar) : null;
    obs?.observe(el);
    return () => { obs?.disconnect(); raiz.style.removeProperty('--pf-convite-reserva'); };
  }, [isMobile]);

  // ...e recolhe sozinho para o Perdidinho após ~12 s sem interação (passar o mouse ou foco dentro pausa a contagem; não move o foco).
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (isMobile || pausa) return;
    const t = setTimeout(() => onboardingServico.recolherConvite(true), RECOLHER_CONVITE_MS);
    return () => clearTimeout(t);
  }, [isMobile, pausa]);

  return (
    <motion.aside ref={aside} className="convite"
      onPointerEnter={() => setPausa(true)} onPointerLeave={() => setPausa(aside.current?.contains(document.activeElement) ?? false)}
      onFocusCapture={() => setPausa(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPausa(false); }} data-origem={isMobile ? 'cartao' : 'ajudante'} aria-labelledby="convite-titulo"
      // Celular: cartão sobe com mola. Desktop: balão nasce do Perdidinho (cauda no canto inferior direito).
      initial={isMobile ? { opacity: 0, y: reduzir ? 0 : 16 } : { opacity: 0, y: reduzir ? 0 : 6, scale: reduzir ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduzir ? 0 : 10, transition: TRANSICAO.saida }}
      transition={isMobile ? { ...TRANSICAO.mola, delay: ATRASO_CONVITE_MS / 1000 }
        : { duration: 0.24, ease: CURVA.saida, delay: ATRASO_CONVITE_MS / 1000 }}>
      {isMobile && <span className="convite__icone" aria-hidden="true"><Icone nome="tour" tamanho={18} /></span>}
      <div className="convite__textos">
        <p id="convite-titulo" className="convite__titulo">{pausado ? 'Continuar o tour?' : `Olá, ${primeiroNome}! Primeira vez por aqui?`}</p>
        <p className="convite__texto">{pausado ? 'Você parou no meio do passo a passo. Retome de onde parou.' : 'Um tour de 1 minuto mostra o essencial do Park Flash para o seu perfil.'}</p>
        <div className="convite__acoes">
          <button type="button" className="pf-btn pf-btn--primary pf-btn--sm"
            onClick={() => (pausado ? onboardingServico.retomar(usuario?.id, nivel) : onboardingServico.iniciar(usuario?.id, nivel))}>
            {pausado ? 'Continuar' : 'Fazer o tour'}
          </button>
          <button type="button" className="pf-btn pf-btn--quiet pf-btn--sm" onClick={onboardingServico.adiarConvite}>Lembrar depois</button>
          <button type="button" className="pf-link-btn convite__nunca" onClick={() => onboardingServico.pular(usuario?.id)}>Não mostrar mais</button>
        </div>
      </div>
    </motion.aside>
  );
}

/** Tour guiado + convite de primeiro acesso (global, dentro do layout autenticado). */
export function TourGuiado() {
  const usuario = useUsuario();
  const ativo = useOnboarding((s) => s.ativo);
  const mostrarConvite = useConviteVisivel(usuario?.id);
  return createPortal(
    <pf-tour>
      <AnimatePresence>{mostrarConvite && <Convite key="convite" />}</AnimatePresence>
      {ativo && ativo.usuario === usuario?.id && <Tour />}
    </pf-tour>,
    document.body,
  );
}

/** Dica contextual de uma tela: aparece uma vez e some quando dispensada. */
export function DicaContextual({ id }: { id: keyof typeof DICAS_CONTEXTUAIS }) {
  const usuario = useUsuario();
  const vista = useOnboarding((s) => progressoDe(s.progresso, usuario?.id).dicasVistas.includes(id));
  const tourAtivo = useOnboarding((s) => !!s.ativo);
  const dica = DICAS_CONTEXTUAIS[id];
  return (
    <AnimatePresence initial={false}>
      {!vista && !tourAtivo && (
        <motion.div className="pf-dica-contextual nao-imprimir" role="note"
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, transition: TRANSICAO.saida }} transition={TRANSICAO.base}>
          <div className="pf-dica-contextual__corpo">
            <Icone nome="dica" tamanho={17} />
            <p><strong>{dica.titulo}.</strong> {dica.texto}</p>
            <button type="button" className="pf-btn pf-btn--quiet pf-btn--sm" onClick={() => onboardingServico.marcarDica(usuario?.id, id)}>Entendi</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
