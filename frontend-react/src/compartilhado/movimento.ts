import { gsap } from 'gsap';
import type { Transition } from 'motion/react';

/**
 * Linguagem de movimento do Park Flash.
 *
 * Divisão de papéis (para não haver duas bibliotecas animando a mesma coisa):
 * - **Motion** (motion/react): presença de componentes React — modais, painel lateral, paleta de comandos,
 *   avisos, dicas, menus e mudanças de layout (etiquetas de filtro, menu recolhido).
 * - **GSAP**: sequências imperativas — entrada das telas, números que contam, login, landing e ilustrações.
 * - **CSS**: estados simples (hover, foco, pressionar) com as variáveis --pf-dur-* e --pf-ease-*.
 *
 * Tudo respeita "reduzir movimento": o Motion pelo MotionConfig (reducedMotion="user")
 * e o GSAP por gsap.matchMedia(). As animações GSAP devolvem uma função de limpeza.
 */

export const movimentoReduzido = '(prefers-reduced-motion: reduce)';
export const movimentoLivre = '(prefers-reduced-motion: no-preference)';

/** Durações em segundos (iguais às variáveis CSS --pf-dur-*). */
export const DURACAO = { instantanea: 0.09, rapida: 0.14, base: 0.22, lenta: 0.38, narrativa: 0.7 } as const;

/** Curvas: "saída" desacelera (elemento chegando), "entrada" acelera (elemento saindo). */
export const CURVA = {
  saida: [0.22, 1, 0.36, 1] as const,
  entrada: [0.55, 0, 1, 0.45] as const,
  suave: [0.65, 0, 0.35, 1] as const,
};
export const EASE_GSAP = { saida: 'expo.out', entrada: 'power2.in', suave: 'power2.inOut', padrao: 'power3.out' } as const;

/** Transições prontas para o Motion. */
export const TRANSICAO = {
  base: { duration: DURACAO.base, ease: CURVA.saida },
  rapida: { duration: DURACAO.rapida, ease: CURVA.saida },
  saida: { duration: DURACAO.rapida, ease: CURVA.entrada },
  mola: { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 },
  molaSuave: { type: 'spring', stiffness: 300, damping: 34 },
} satisfies Record<string, Transition>;

const reduzido = () => typeof window !== 'undefined' && window.matchMedia(movimentoReduzido).matches;

/** Entrada suave (opacidade + leve subida), opcionalmente em cascata. */
export function entrada(alvos: Element[], deslocamento = 6, escalonar = false): () => void {
  const media = gsap.matchMedia();
  media.add(movimentoLivre, () => {
    gsap.from(alvos, {
      opacity: 0,
      ...(deslocamento ? { y: deslocamento } : {}),
      duration: DURACAO.base,
      stagger: escalonar ? 0.035 : 0,
      ease: EASE_GSAP.padrao,
      clearProps: deslocamento ? 'opacity,transform' : 'opacity',
    });
  });
  return () => media.revert();
}

/** Saída (usada por componentes que fecham sozinhos antes de avisar o pai). */
export function saida(fundo: HTMLElement, painel: HTMLElement, fechar: () => void): () => void {
  const consulta = window.matchMedia(movimentoReduzido);
  if (consulta.matches) {
    fechar();
    return () => {};
  }
  const contexto = gsap.context(() => {
    gsap.timeline({ onComplete: concluir })
      .to(fundo, { opacity: 0, duration: DURACAO.rapida, ease: EASE_GSAP.entrada }, 0)
      .to(painel, { y: 5, opacity: 0, duration: DURACAO.rapida, ease: EASE_GSAP.entrada }, 0);
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

/**
 * Entrada de uma tela: título, indicadores, cartões e linhas, em cascata curta
 * (no máximo ~0,4 s no total, para não atrasar quem usa o sistema o dia todo).
 */
export function entradaDeTela(raiz: HTMLElement): () => void {
  const media = gsap.matchMedia();
  media.add(movimentoLivre, () => {
    const q = (seletor: string) => [...raiz.querySelectorAll<HTMLElement>(seletor)];
    const titulo = q('pf-page-header .head');
    const blocos = q('[data-entrada], .pf-grid-kpi > *, pf-barra-filtros').slice(0, 10);
    const cartoes = q('.pf-card:not(.pf-grid-kpi *)').slice(0, 4);
    const linhas = q('.pf-table tbody tr, [data-entrada-linha]').slice(0, 14);
    const tl = gsap.timeline({ defaults: { ease: EASE_GSAP.padrao, duration: DURACAO.lenta } });
    if (titulo.length) tl.from(titulo, { opacity: 0, y: 8, clearProps: 'opacity,transform' }, 0);
    if (blocos.length) tl.from(blocos, { opacity: 0, y: 10, stagger: 0.03, clearProps: 'opacity,transform' }, 0.04);
    if (cartoes.length) tl.from(cartoes, { opacity: 0, y: 12, stagger: 0.05, clearProps: 'opacity,transform' }, 0.08);
    if (linhas.length) tl.from(linhas, { opacity: 0, x: -4, stagger: 0.012, duration: DURACAO.base, clearProps: 'opacity,transform' }, 0.14);
  });
  return () => media.revert();
}

/**
 * Número que conta até o valor final (indicadores). Só anima na primeira exibição
 * e quando o valor muda; sem movimento, mostra o valor final direto.
 */
export function contar(elemento: HTMLElement, de: number, ate: number, formatar: (n: number) => string): () => void {
  if (reduzido() || de === ate) {
    elemento.textContent = formatar(ate);
    return () => {};
  }
  const estado = { valor: de };
  const tween = gsap.to(estado, {
    valor: ate,
    duration: DURACAO.narrativa,
    ease: 'power2.out',
    onUpdate: () => { elemento.textContent = formatar(estado.valor); },
    onComplete: () => { elemento.textContent = formatar(ate); },
  });
  return () => {
    tween.kill();
    elemento.textContent = formatar(ate);
  };
}

/** Pequeno "pulso" de confirmação (ex.: chave Pix copiada, situação atualizada). */
export function pulso(elemento: Element): () => void {
  if (reduzido()) return () => {};
  const tween = gsap.fromTo(elemento, { scale: 0.96 }, { scale: 1, duration: DURACAO.lenta, ease: 'back.out(3)', clearProps: 'transform' });
  return () => tween.kill();
}

/** Opções de animação do Chart.js alinhadas à linguagem de movimento. */
export const ANIMACAO_GRAFICO = { duration: 620, easing: 'easeOutQuart' as const };
