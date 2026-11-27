import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { PropsMascote } from '../../nucleo/onboarding/mascote';
import { reduzido } from '../movimento';
import './perdidinho.scss';

type Direcao = { x: number; y: number };

/**
 * Para onde fica o item destacado, visto do cartão. `lado` diz onde o cartão está em relação
 * ao item; o Perdidinho aponta para o lado oposto (cartão embaixo = item em cima).
 */
export function direcaoDoAlvo(lado: PropsMascote['lado']): Direcao {
  switch (lado) {
    case 'bottom': return { x: 0, y: -1 };
    case 'top': return { x: 0, y: 1 };
    case 'right': return { x: -1, y: 0 };
    case 'left': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

/** Olhar fixo de cada humor (null = livre: segue o mouse em ponteiro fino). */
function olharDoHumor(humor: PropsMascote['humor'], lado: PropsMascote['lado']): Direcao | null {
  if (humor === 'pensando') return { x: -0.5, y: -1 };
  if (humor === 'apontando') return direcaoDoAlvo(lado);
  return null;
}

const transformOlhar = (d: Direcao) => `translate(${(Math.max(-1, Math.min(1, d.x)) * 3.2).toFixed(2)}px, ${(Math.max(-1, Math.min(1, d.y)) * 2.6).toFixed(2)}px)`;

// Espessura: a mesma forma repetida em diagonal, atrás da face.
const PROFUNDIDADE = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

/**
 * Perdidinho, o guia do Park Flash: cubinho 2,5D (face azul da marca, laterais azul-marinho,
 * olhos claros e um raio âmbar do logo). Implementa `PropsMascote` do tour guiado.
 *
 * Movimento (GSAP, só transform/opacity), sempre dentro de `gsap.context` revertido ao trocar
 * de passo ou desmontar. Com "reduzir movimento" (prop ou sistema) nada se move: só a expressão muda.
 */
export function Perdidinho({ humor, falando, passo, lado, reduzirMovimento, decorativo = false, tamanho = 64 }: PropsMascote & {
  /** Uso só ilustrativo (ex.: apresentação): some para o leitor de tela. */
  decorativo?: boolean;
  tamanho?: number;
}) {
  const id = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const gesto = useRef<SVGGElement>(null);
  const sombra = useRef<SVGEllipseElement>(null);
  const olhar = useRef<SVGGElement>(null);
  const boca = useRef<SVGRectElement>(null);

  const parado = reduzirMovimento || reduzido();
  const alegre = humor === 'acenando' || humor === 'comemorando';
  const olharFixo = olharDoHumor(humor, lado);
  const olharX = olharFixo?.x ?? 0;
  const olharY = olharFixo?.y ?? 0;

  // Gestos de cada humor. Reexecuta a cada passo; o revert devolve tudo à pose neutra.
  useLayoutEffect(() => {
    if (parado || !gesto.current) return;
    const corpo = gesto.current;
    const ctx = gsap.context(() => {
      gsap.set(corpo, { transformOrigin: '50% 90%' });
      const balancar = (atraso = 0) => gsap.timeline({ repeat: -1, delay: atraso, defaults: { ease: 'sine.inOut' } })
        .to(corpo, { y: -2.5, rotation: -1.5, duration: 1.1 })
        .to(corpo, { y: -1.5, rotation: 1.5, duration: 1.4 })
        .to(corpo, { y: 0, rotation: 0, duration: 1.1 });

      if (humor === 'acenando') {
        // Oi: balança de um lado para o outro uma vez e fica vivo.
        gsap.timeline({ delay: 0.2 })
          .to(corpo, { rotation: -14, y: -6, duration: 0.14, ease: 'power2.out' })
          .to(corpo, { rotation: 12, duration: 0.16, ease: 'sine.inOut' })
          .to(corpo, { rotation: -8, duration: 0.14, ease: 'sine.inOut' })
          .to(corpo, { rotation: 0, y: 0, duration: 0.3, ease: 'back.out(2)' });
        balancar(1.2);
      }

      if (humor === 'explicando') balancar();

      if (humor === 'apontando') {
        // Inclina para o item, assenta na metade e "cutuca" de novo de tempos em tempos.
        const d = direcaoDoAlvo(lado);
        gsap.timeline({ delay: 0.15 })
          .to(corpo, { rotation: d.x * 10, x: d.x * 4, y: d.y * 4, duration: 0.28, ease: 'power2.out' })
          .to(corpo, { rotation: d.x * 5, x: d.x * 2, y: d.y * 2, duration: 0.5, ease: 'elastic.out(1, 0.6)' });
        gsap.timeline({ repeat: -1, delay: 2.4, repeatDelay: 2 })
          .to(corpo, { rotation: d.x * 10, x: d.x * 4, y: d.y * 4, duration: 0.22, ease: 'power2.out' })
          .to(corpo, { rotation: d.x * 5, x: d.x * 2, y: d.y * 2, duration: 0.4, ease: 'power2.out' });
      }

      if (humor === 'comemorando') {
        // Dois pulinhos (o segundo menor), com pouso amassado e sombra que encolhe no ar.
        const pulo = (altura: number) => gsap.timeline()
          .to(corpo, { y: -altura, duration: 0.14, ease: 'power2.out' })
          .to(sombra.current, { scaleX: 0.7, opacity: 0.12, duration: 0.14, ease: 'power2.out', transformOrigin: '50% 50%' }, '<')
          .to(corpo, { y: 0, duration: 0.16, ease: 'power2.in' })
          .to(sombra.current, { scaleX: 1, opacity: 0.22, duration: 0.16, ease: 'power2.in' }, '<')
          .to(corpo, { scaleX: 1.08, scaleY: 0.9, transformOrigin: '50% 100%', duration: 0.08, ease: 'power2.out' })
          .to(corpo, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(3)' });
        gsap.timeline({ delay: 0.2 }).add(pulo(10)).add(pulo(6), '+=0.08');
      }

      if (humor === 'pensando') {
        // Cabeça de lado, oscilando bem devagar ("hmm").
        gsap.timeline()
          .to(corpo, { rotation: -4, y: -1, duration: 0.4, ease: 'power2.out' })
          .to(corpo, { rotation: -2, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }

      // "Fala": a boquinha abre e fecha algumas vezes quando o texto do passo aparece.
      if (falando && humor !== 'pensando' && humor !== 'comemorando' && boca.current) {
        gsap.timeline({ delay: humor === 'acenando' ? 0.9 : 0.3 })
          .set(boca.current, { opacity: 1, scaleY: 0.35, transformOrigin: '50% 50%' })
          .to(boca.current, { scaleY: 1, duration: 0.09, ease: 'sine.inOut', yoyo: true, repeat: 7 })
          .to(boca.current, { opacity: 0, duration: 0.12, ease: 'power1.in' });
      }
    }, svg);
    return () => ctx.revert();
  }, [humor, falando, passo, lado, parado]);

  // Olhos seguem o mouse só em ponteiro fino, com movimento permitido e sem olhar fixo.
  const olharLivre = !olharFixo;
  useEffect(() => {
    const el = olhar.current;
    if (parado || !olharLivre || !el || !window.matchMedia('(pointer: fine)').matches) return;
    let quadro = 0;
    let ultimo: PointerEvent | null = null;
    const atualizar = () => {
      quadro = 0;
      const r = svg.current?.getBoundingClientRect();
      if (!ultimo || !r) return;
      const cx = r.left + r.width * 0.44;
      const cy = r.top + r.height * 0.55;
      el.style.transform = transformOlhar({ x: (ultimo.clientX - cx) / 220, y: (ultimo.clientY - cy) / 220 });
    };
    const aoMover = (e: PointerEvent) => {
      ultimo = e;
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    window.addEventListener('pointermove', aoMover, { passive: true });
    return () => {
      window.removeEventListener('pointermove', aoMover);
      cancelAnimationFrame(quadro);
      el.style.transform = '';
    };
  }, [parado, olharLivre]);

  return (
    <pf-perdidinho {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Perdidinho, o guia do Park Flash' })} data-humor={humor}>
      <svg ref={svg} className={`perdidinho${parado ? '' : ' perdidinho--vivo'}`} viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
            <stop className="perdidinho__luz-a" offset="0" />
            <stop className="perdidinho__luz-b" offset="1" />
          </linearGradient>
        </defs>
        <ellipse ref={sombra} className="perdidinho__sombra" cx="29" cy="61.5" rx="17" ry="2.4" />
        <g ref={gesto}>
          <g className="perdidinho__lado">
            {PROFUNDIDADE.map((d) => <rect key={d} x={6 + d} y={14 - d} width="44" height="44" rx="12" />)}
          </g>
          <path className="perdidinho__aresta" d="M22 10 H44 Q54 10 54 20 V42" strokeWidth="1" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
          <rect x="6" y="14" width="44" height="44" rx="12" fill={`url(#${id}-face)`} />
          <path className="perdidinho__brilho" d="M13 24 Q13.5 19 19 18.5" strokeOpacity="0.32" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {/* Raio âmbar do logo, no canto da face. */}
          <path className="perdidinho__raio" d="M44.6 44.5 L40.4 50.2 H43.2 L41.8 55.2 L46.2 49 H43.4 Z" />
          <g ref={olhar} className="perdidinho__olhar" style={{ transform: transformOlhar({ x: olharX, y: olharY }) }}>
            {alegre ? (
              <g className="perdidinho__alegre" strokeWidth="3.2" strokeLinecap="round" fill="none">
                <path d="M17 38.5 Q20.5 32.5 24 38.5" />
                <path d="M32 38.5 Q35.5 32.5 39 38.5" />
              </g>
            ) : (
              <g className="perdidinho__olhos">
                <rect x="17.5" y="29" width="6" height="12" rx="3" />
                <rect x="32.5" y="29" width="6" height="12" rx="3" />
              </g>
            )}
          </g>
          <rect ref={boca} className="perdidinho__boca" x="25" y="45" width="6" height="3.4" rx="1.7" />
        </g>
      </svg>
    </pf-perdidinho>
  );
}
