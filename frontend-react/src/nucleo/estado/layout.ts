import { useSyncExternalStore } from 'react';

/** Ponto de virada entre o layout mobile (barra inferior) e o desktop (sidebar). */
export const BREAKPOINT_DESKTOP = '(min-width: 768px)';

function useMidia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const midia = window.matchMedia(consulta);
      midia.addEventListener('change', avisar);
      return () => midia.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

export const useIsMobile = () => !useMidia(BREAKPOINT_DESKTOP);
export const useMovimentoReduzido = () => useMidia('(prefers-reduced-motion: reduce)');
