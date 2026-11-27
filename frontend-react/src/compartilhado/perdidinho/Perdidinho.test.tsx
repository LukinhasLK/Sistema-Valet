import { render, screen } from '@testing-library/react';
import { gsap } from 'gsap';
import type { HumorMascote } from '../../nucleo/onboarding/mascote';
import { Perdidinho, direcaoDoAlvo } from './Perdidinho';

const HUMORES: HumorMascote[] = ['acenando', 'explicando', 'apontando', 'comemorando', 'pensando'];

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
      const alegre = humor === 'acenando' || humor === 'comemorando';
      expect(!!container.querySelector('.perdidinho__alegre')).toBe(alegre);
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
});
