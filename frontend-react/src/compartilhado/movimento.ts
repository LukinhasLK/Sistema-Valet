import { animate, stagger } from 'motion';
import type { Transition } from 'motion/react';

/**
 * Linguagem de movimento do Park Flash.
 *
 * Papéis (sem duas bibliotecas animando a mesma coisa):
 * - **Motion** em todo o sistema: presença de componentes (motion/react) e sequências imperativas
 *   (`animate`/`stagger`): entrada das telas, números que contam, login e ilustrações.
 * - **GSAP** só nas páginas públicas (apresentação e planos), por causa do ScrollTrigger.
 *   Elas carregam em pacotes separados, então o sistema não baixa o GSAP.
 * - **CSS**: estados simples (hover, foco, pressionar) com as variáveis --pf-dur-* e --pf-ease-*.
 *
 * Tudo respeita "reduzir movimento" e devolve uma função de limpeza.
 */

export const movimentoReduzido = '(prefers-reduced-motion: reduce)';
export const movimentoLivre = '(prefers-reduced-motion: no-preference)';

/** Durações em segundos (iguais às variáveis CSS --pf-dur-*). */
export const DURACAO = { instantanea: 0.09, rapida: 0.14, base: 0.22, lenta: 0.38, narrativa: 0.7 } as const;

/** Curvas: "saída" desacelera (elemento chegando), "entrada" acelera (elemento saindo). */
export const CURVA = {
  saida: [0.22, 1, 0.36, 1] as [number, number, number, number],
  entrada: [0.55, 0, 1, 0.45] as [number, number, number, number],
  suave: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

/** Transições prontas para o Motion. */
export const TRANSICAO = {
  base: { duration: DURACAO.base, ease: CURVA.saida },
  rapida: { duration: DURACAO.rapida, ease: CURVA.saida },
  saida: { duration: DURACAO.rapida, ease: CURVA.entrada },
  mola: { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 },
  molaSuave: { type: 'spring', stiffness: 300, damping: 34 },
} satisfies Record<string, Transition>;

export const reduzido = () => typeof window !== 'undefined' && window.matchMedia(movimentoReduzido).matches;

type Controle = { complete: () => void };
const limpar = (controles: Controle[]) => () => controles.forEach((c) => c.complete());

/** Entrada suave (opacidade + leve subida), opcionalmente em cascata. */
export function entrada(alvos: Element[], deslocamento = 6, escalonar = false): () => void {
  if (reduzido() || !alvos.length) return () => {};
  return limpar([animate(alvos, { opacity: [0, 1], ...(deslocamento ? { y: [deslocamento, 0] } : {}) },
    { duration: DURACAO.base, ease: CURVA.saida, delay: escalonar ? stagger(0.035) : 0 })]);
}

/**
 * Entrada de uma tela: título, indicadores, cartões e linhas, em cascata curta
 * (no máximo ~0,4 s no total, para não atrasar quem usa o sistema o dia todo).
 */
export function entradaDeTela(raiz: HTMLElement): () => void {
  if (reduzido()) return () => {};
  const q = (seletor: string) => [...raiz.querySelectorAll<HTMLElement>(seletor)];
  const grupos: [HTMLElement[], number, number, Record<string, number[]>][] = [
    [q('pf-page-header .head'), 0, 0, { y: [8, 0] }],
    [q('[data-entrada], .pf-grid-kpi > *, pf-barra-filtros').slice(0, 10), 0.04, 0.03, { y: [10, 0] }],
    [q('.pf-card:not(.pf-grid-kpi *)').slice(0, 4), 0.08, 0.05, { y: [12, 0] }],
    [q('.pf-table tbody tr, [data-entrada-linha]').slice(0, 14), 0.14, 0.012, { x: [-4, 0] }],
  ];
  return limpar(grupos.filter(([alvos]) => alvos.length).map(([alvos, inicio, passo, desloc]) =>
    animate(alvos, { opacity: [0, 1], ...desloc }, { duration: DURACAO.lenta, ease: CURVA.saida, delay: stagger(passo, { startDelay: inicio }) })));
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
  const controle = animate(de, ate, {
    duration: DURACAO.narrativa,
    ease: CURVA.saida,
    onUpdate: (v) => { elemento.textContent = formatar(v); },
    onComplete: () => { elemento.textContent = formatar(ate); },
  });
  return () => {
    controle.stop();
    elemento.textContent = formatar(ate);
  };
}

/** Pequeno "pulso" de confirmação (ex.: situação da ficha atualizada). */
export function pulso(elemento: Element): () => void {
  if (reduzido()) return () => {};
  return limpar([animate(elemento, { scale: [0.96, 1] }, { type: 'spring', stiffness: 400, damping: 14 })]);
}

/** Flutuação contínua e discreta (ilustrações). */
export function flutuar(alvos: Element[], amplitude = 3, duracao = 2.6): () => void {
  if (reduzido() || !alvos.length) return () => {};
  const c = animate(alvos, { y: [0, -amplitude] }, { duration: duracao, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' });
  return () => c.stop();
}

/** Opções de animação do Chart.js alinhadas à linguagem de movimento. */
export const ANIMACAO_GRAFICO = { duration: 620, easing: 'easeOutQuart' as const };
