import { RefObject, useLayoutEffect } from 'react';
import { entrada } from './movimento';

/** Equivalente à diretiva pfAppear: entrada suave do elemento ao aparecer. */
export function useAparecer(ref: RefObject<HTMLElement | null>, deslocamento = 4, ativo = true): void {
  useLayoutEffect(() => {
    if (!ativo || !ref.current) return;
    return entrada([ref.current], deslocamento);
  }, [ref, deslocamento, ativo]);
}
