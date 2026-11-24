import { RefObject, useEffect } from 'react';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mantém o foco do teclado dentro do painel (como o cdkTrapFocus do Angular):
 * foca o elemento inicial ao abrir, cicla com Tab e devolve o foco ao fechar.
 */
export function usePrenderFoco(painel: RefObject<HTMLElement | null>, inicial?: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const elemento = painel.current;
    if (!elemento) return;
    (inicial?.current ?? elemento.querySelector<HTMLElement>(FOCAVEIS))?.focus({ preventScroll: true });

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Tab') return;
      const itens = [...elemento.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((e) => e.offsetParent !== null || e === document.activeElement);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === elemento)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    elemento.addEventListener('keydown', aoTeclar);
    return () => {
      elemento.removeEventListener('keydown', aoTeclar);
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [painel, inicial]);
}
