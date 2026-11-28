import { cloneElement, ReactElement, ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { TRANSICAO } from './movimento';
import './dica.scss';

type Lado = 'top' | 'right' | 'bottom' | 'left';

interface Props {
  texto: ReactNode;
  /** Atalho de teclado exibido ao lado do texto (ex.: "⌘K"). */
  atalho?: string;
  lado?: Lado;
  /** Desliga a dica sem mudar a árvore (ex.: menu expandido já mostra o rótulo). */
  desligada?: boolean;
  children: ReactElement;
}

const ATRASO_MOUSE = 380;
const DESLOCAMENTO: Record<Lado, { x?: number; y?: number }> = { top: { y: 3 }, bottom: { y: -3 }, left: { x: 3 }, right: { x: -3 } };

/**
 * Dica ao passar o mouse ou focar pelo teclado (não aparece no toque, onde atrapalharia).
 * O elemento recebe `aria-describedby` enquanto a dica está visível.
 */
export function Dica({ texto, atalho, lado = 'top', desligada = false, children }: Props) {
  const id = useId();
  const ancora = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [visivel, setVisivel] = useState(false);
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const mostrar = useCallback((imediato: boolean) => {
    if (desligada) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(true), imediato ? 0 : ATRASO_MOUSE);
  }, [desligada]);
  const esconder = useCallback(() => {
    clearTimeout(timer.current);
    setVisivel(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (desligada) esconder(); }, [desligada, esconder]);

  useEffect(() => {
    if (!visivel) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') esconder(); };
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', esconder, true);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', esconder, true);
    };
  }, [visivel, esconder]);

  useLayoutEffect(() => {
    if (!visivel || !ancora.current || !caixa.current) return;
    const r = ancora.current.getBoundingClientRect();
    const c = caixa.current.getBoundingClientRect();
    const margem = 8;
    let left = 0;
    let top = 0;
    if (lado === 'right') { left = r.right + margem; top = r.top + r.height / 2 - c.height / 2; }
    if (lado === 'left') { left = r.left - c.width - margem; top = r.top + r.height / 2 - c.height / 2; }
    if (lado === 'top') { left = r.left + r.width / 2 - c.width / 2; top = r.top - c.height - margem; }
    if (lado === 'bottom') { left = r.left + r.width / 2 - c.width / 2; top = r.bottom + margem; }
    if (lado === 'top' && top < 4) top = r.bottom + margem;
    left = Math.max(6, Math.min(left, innerWidth - c.width - 6));
    top = Math.max(6, Math.min(top, innerHeight - c.height - 6));
    setPosicao({ left, top });
  }, [visivel, lado, texto]);

  const filho = cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      ancora.current = el;
      const original = (children as unknown as { ref?: unknown }).ref;
      if (typeof original === 'function') original(el);
      else if (original && typeof original === 'object') (original as { current: unknown }).current = el;
    },
    'aria-describedby': visivel ? id : children.props['aria-describedby'],
    onPointerEnter: (e: React.PointerEvent) => { children.props.onPointerEnter?.(e); if (e.pointerType === 'mouse') mostrar(false); },
    onPointerLeave: (e: React.PointerEvent) => { children.props.onPointerLeave?.(e); esconder(); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { children.props.onFocus?.(e); if (e.currentTarget.matches(':focus-visible')) mostrar(true); },
    onBlur: (e: React.FocusEvent) => { children.props.onBlur?.(e); esconder(); },
    onPointerDown: (e: React.PointerEvent) => { children.props.onPointerDown?.(e); esconder(); },
  });

  return (
    <>
      {filho}
      {createPortal(
        <AnimatePresence>
          {visivel && (
            <motion.div
              ref={caixa}
              key="dica"
              id={id}
              role="tooltip"
              className="pf-dica"
              style={{ left: posicao?.left ?? -9999, top: posicao?.top ?? -9999 }}
              initial={{ opacity: 0, ...DESLOCAMENTO[lado] }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, transition: TRANSICAO.saida }}
              transition={TRANSICAO.rapida}
            >
              <span>{texto}</span>
              {atalho && <kbd className="pf-dica__atalho">{atalho}</kbd>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
