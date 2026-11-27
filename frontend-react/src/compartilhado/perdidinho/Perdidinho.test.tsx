import { render, screen } from '@testing-library/react';
import { gsap } from 'gsap';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { Perdidinho, direcaoDoAlvo, olhosDoHumor, sobrancelhasDoHumor } from './Perdidinho';

const HUMORES: HumorMascote[] = ['acenando', 'explicando', 'apontando', 'comemorando', 'pensando', 'feliz', 'triste', 'chorando', 'surpreso', 'dormindo'];

/** Simula o sistema pedindo "reduzir movimento". */
function sistemaReduzido() {
  const original = window.matchMedia;
  window.matchMedia = ((consulta: string) => ({ ...original(consulta), matches: consulta.includes('reduce') })) as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

describe('Perdidinho', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(HUMORES)('desenha o humor "%s" com nome acessível', (humor) => {
    const { unmount } = render(<Perdidinho humor={humor} falando passo="p1" lado="bottom" reduzirMovimento={false} />);
    const img = screen.getByRole('img', { name: 'Perdidinho, o guia do Park Flash' });
    expect(img.getAttribute('data-humor')).toBe(humor);
    expect(img.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    unmount();
  });

  it('com movimento permitido usa o GSAP e reverte tudo ao desmontar', () => {
    const contexto = vi.spyOn(gsap, 'context');
    const { unmount } = render(<Perdidinho humor="acenando" falando passo="p1" lado="bottom" reduzirMovimento={false} />);
    expect(contexto).toHaveBeenCalled();
    const ctx = contexto.mock.results[0].value as gsap.Context;
    const reverter = vi.spyOn(ctx, 'revert');
    unmount();
    expect(reverter).toHaveBeenCalled();
  });

  it('com reduzirMovimento não anima nada, só muda a expressão', () => {
    const to = vi.spyOn(gsap, 'to');
    const timeline = vi.spyOn(gsap, 'timeline');
    const contexto = vi.spyOn(gsap, 'context');
    for (const humor of HUMORES) {
      const { container, unmount } = render(<Perdidinho humor={humor} falando passo="p1" lado="right" reduzirMovimento />);
      const alegre = humor === 'acenando' || humor === 'comemorando' || humor === 'feliz';
      expect(!!container.querySelector('.perdidinho__alegre')).toBe(alegre);
      expect(container.querySelector('pf-perdidinho')?.getAttribute('data-olhos')).toBe(olhosDoHumor(humor));
      expect(container.querySelector('.perdidinho--vivo')).toBeNull();
      unmount();
    }
    expect(to).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
    expect(contexto).not.toHaveBeenCalled();
  });

  it('pensando olha para cima e apontando olha para o item destacado', () => {
    const { container, rerender } = render(<Perdidinho humor="pensando" falando passo="p1" lado="bottom" reduzirMovimento />);
    const olhar = () => (container.querySelector('.perdidinho__olhar') as SVGGElement).style.transform;
    expect(olhar()).toContain('-2.60px');
    rerender(<Perdidinho humor="apontando" falando passo="p1" lado="right" reduzirMovimento />);
    expect(olhar()).toContain('translate(-3.20px');
    expect(direcaoDoAlvo('bottom')).toEqual({ x: 0, y: -1 });
  });

  it('decorativo some para o leitor de tela', () => {
    const { container } = render(<Perdidinho humor="acenando" falando={false} passo="p" lado="centro" reduzirMovimento decorativo />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('pf-perdidinho')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('novos humores: triste (olhos caídos e olhar baixo), surpreso (olhos arregalados, sem boca), dormindo (olhos fechados e "z")', () => {
    const { container, rerender } = render(<Perdidinho humor="triste" falando passo="p" lado="centro" reduzirMovimento />);
    const olhar = () => (container.querySelector('.perdidinho__olhar') as SVGGElement).style.transform;
    expect(container.querySelector('.perdidinho__tristes')).not.toBeNull();
    expect(olhar()).toContain('2.08px');

    rerender(<Perdidinho humor="surpreso" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelector('.perdidinho__arregalados')).not.toBeNull();
    expect(container.querySelector('[class*="perdidinho__boca"]')).toBeNull(); // sem boca em nenhum humor

    rerender(<Perdidinho humor="dormindo" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelector('.perdidinho__fechados')).not.toBeNull();
    expect(container.querySelectorAll('.perdidinho__zzz path')).toHaveLength(2);
    expect(container.querySelector('.perdidinho__olhos')).toBeNull();
  });

  it.each(HUMORES)('"%s" não tem boca (a expressão é dos olhos)', (humor) => {
    const { container } = render(<Perdidinho humor={humor} falando passo="p" lado="centro" reduzirMovimento={false} />);
    expect(container.querySelector('[class*="boca"]')).toBeNull();
  });

  it.each(HUMORES)('"%s" só tem sobrancelha quando a expressão pede', (humor) => {
    const { container } = render(<Perdidinho humor={humor} falando passo="p" lado="centro" reduzirMovimento />);
    const sb = container.querySelector('.perdidinho__sobrancelhas');
    const esperado = sobrancelhasDoHumor(humor);
    expect(sb?.getAttribute('data-forma') ?? null).toBe(esperado);
    if (sb) expect(sb.querySelectorAll('path')).toHaveLength(2);
    expect(['triste', 'chorando', 'surpreso', 'pensando'].includes(humor)).toBe(!!esperado);
  });

  it('feliz: olhos em arco (^^), sem sobrancelha nem lágrima', () => {
    const { container } = render(<Perdidinho humor="feliz" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelectorAll('.perdidinho__alegre path')).toHaveLength(2);
    expect(container.querySelector('pf-perdidinho')?.getAttribute('data-olhos')).toBe('alegres');
    expect(container.querySelector('.perdidinho__sobrancelhas, .perdidinho__lagrima')).toBeNull();
  });

  it('triste: olhos caídos, sobrancelhas de preocupação e olhar para baixo, sem lágrima', () => {
    const { container } = render(<Perdidinho humor="triste" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelector('.perdidinho__tristes')).not.toBeNull();
    expect(container.querySelector('.perdidinho__sobrancelhas')?.getAttribute('data-forma')).toBe('tristes');
    expect((container.querySelector('.perdidinho__olhar') as SVGGElement).style.transform).toContain('2.08px');
    expect(container.querySelector('.perdidinho__lagrima')).toBeNull();
  });

  it('chorando: base do triste + uma lágrima em cada olho', () => {
    const { container } = render(<Perdidinho humor="chorando" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelector('.perdidinho__tristes')).not.toBeNull();
    expect(container.querySelector('.perdidinho__sobrancelhas')?.getAttribute('data-forma')).toBe('tristes');
    expect(container.querySelectorAll('.perdidinho__lagrima')).toHaveLength(2);
    expect((container.querySelector('.perdidinho__olhar') as SVGGElement).style.transform).toContain('2.08px');
  });

  it('chorando com reduzir movimento: lágrimas paradas, sem gsap.to', () => {
    const to = vi.spyOn(gsap, 'to');
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container } = render(<Perdidinho humor="chorando" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelectorAll('.perdidinho__lagrima')).toHaveLength(2);
    expect(container.querySelector('.perdidinho--vivo')).toBeNull();
    expect(to).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
  });

  it('chorando com movimento: as lágrimas escorrem (GSAP) e tudo é revertido ao desmontar', () => {
    const timeline = vi.spyOn(gsap, 'timeline');
    const contexto = vi.spyOn(gsap, 'context');
    const { container, unmount } = render(<Perdidinho humor="chorando" falando passo="p" lado="centro" reduzirMovimento={false} />);
    const linhas = timeline.mock.results.map((r) => r.value as gsap.core.Timeline);
    const gotas = [...container.querySelectorAll('.perdidinho__lagrima')];
    expect(gotas).toHaveLength(2);
    gotas.forEach((g) => expect(linhas.some((tl) => tl.repeat() === -1 && tl.getTweensOf(g).length > 0)).toBe(true));
    const reverter = contexto.mock.results.map((r) => vi.spyOn(r.value as gsap.Context, 'revert'));
    unmount();
    reverter.forEach((r) => expect(r).toHaveBeenCalled());
  });

  it('surpreso: olhos arregalados e sobrancelhas levantadas', () => {
    const { container } = render(<Perdidinho humor="surpreso" falando passo="p" lado="centro" reduzirMovimento />);
    expect(container.querySelectorAll('.perdidinho__arregalados ellipse')).toHaveLength(2);
    expect(container.querySelector('.perdidinho__sobrancelhas')?.getAttribute('data-forma')).toBe('levantadas');
  });

  it.each(['feliz', 'triste', 'chorando', 'surpreso', 'dormindo'] as HumorMascote[])('"%s" anima com GSAP e limpa ao desmontar', (humor) => {
    const contexto = vi.spyOn(gsap, 'context');
    const { unmount } = render(<Perdidinho humor={humor} falando passo="p1" lado="centro" reduzirMovimento={false} />);
    expect(contexto).toHaveBeenCalled();
    const contextos = contexto.mock.results.map((r) => r.value as gsap.Context);
    const reverter = contextos.map((c) => vi.spyOn(c, 'revert'));
    unmount();
    reverter.forEach((r) => expect(r).toHaveBeenCalled());
  });

  it('troca de humor sem remontar: reverte o gesto anterior e começa o novo', () => {
    const contexto = vi.spyOn(gsap, 'context');
    const { rerender, container } = render(<Perdidinho humor="explicando" falando passo="p1" lado="bottom" reduzirMovimento={false} />);
    const antes = contexto.mock.results.map((r) => vi.spyOn(r.value as gsap.Context, 'revert'));
    rerender(<Perdidinho humor="surpreso" falando passo="p2" lado="bottom" reduzirMovimento={false} />);
    // Gesto e olhos recomeçam; a respiração (mesmo ritmo) continua sem reiniciar.
    expect(antes[0]).toHaveBeenCalled();
    expect(antes.filter((r) => r.mock.calls.length > 0)).toHaveLength(2);
    expect(contexto.mock.calls.length).toBeGreaterThan(antes.length);
    expect(container.querySelector('pf-perdidinho')?.getAttribute('data-humor')).toBe('surpreso');
  });

  it('com o sistema em "reduzir movimento" não anima nada, mesmo sem a prop', () => {
    const restaurar = sistemaReduzido();
    try {
      const contexto = vi.spyOn(gsap, 'context');
      const { container } = render(<Perdidinho humor="comemorando" falando passo="p1" lado="bottom" reduzirMovimento={false} />);
      expect(contexto).not.toHaveBeenCalled();
      expect(container.querySelector('.perdidinho--vivo')).toBeNull();
    } finally {
      restaurar();
    }
  });
});
