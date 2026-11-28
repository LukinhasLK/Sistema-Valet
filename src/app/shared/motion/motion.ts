import { gsap } from 'gsap';

export const movimentoReduzido = '(prefers-reduced-motion: reduce)';

export function entrada(alvos: HTMLElement[], deslocamento = 6, escalonar = false): () => void {
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from(alvos, {
      opacity: 0,
      ...(deslocamento ? { y: deslocamento } : {}),
      duration: 0.2,
      stagger: escalonar ? 0.025 : 0,
      ease: 'power2.out',
      clearProps: deslocamento ? 'opacity,transform' : 'opacity',
    });
  });
  return () => media.revert();
}

export function saida(fundo: HTMLElement, painel: HTMLElement, fechar: () => void): () => void {
  const consulta = window.matchMedia(movimentoReduzido);
  if (consulta.matches) {
    fechar();
    return () => {};
  }
  const contexto = gsap.context(() => {
    gsap.timeline({ onComplete: concluir })
      .to(fundo, { opacity: 0, duration: 0.14, ease: 'power1.in' }, 0)
      .to(painel, { y: 5, duration: 0.14, ease: 'power1.in' }, 0);
  });
  consulta.addEventListener('change', concluir, { once: true });
  function concluir(): void {
    consulta.removeEventListener('change', concluir);
    fechar();
  }
  return () => {
    consulta.removeEventListener('change', concluir);
    contexto.revert();
  };
}
