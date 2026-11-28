import { act, renderHook } from '@testing-library/react';
import { AMPLITUDE_MAX, SOLTA_OLHAR_MS, direcaoAte, useAlvoDoOlhar } from './useAlvoDoOlhar';

const caixa = (left: number, top: number, w = 40, h = 40) => ({
  left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON: () => ({}),
}) as DOMRect;

function botaoEm(left: number, top: number) {
  const b = document.createElement('button');
  b.getBoundingClientRect = () => caixa(left, top);
  document.body.appendChild(b);
  return b;
}

const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('useAlvoDoOlhar', () => {
  let mascote: HTMLSpanElement;
  let ref: { current: HTMLElement };
  beforeEach(() => {
    mascote = document.createElement('span');
    ref = { current: mascote };
    mascote.getBoundingClientRect = () => caixa(1000, 700, 48, 48);
    document.body.appendChild(mascote);
  });
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

  it('limita a amplitude (nunca encosta na órbita) e achata o eixo y', () => {
    const longe = direcaoAte(-5000, 0);
    expect(Math.hypot(longe.x, longe.y)).toBeCloseTo(AMPLITUDE_MAX);
    const cima = direcaoAte(0, -5000);
    expect(Math.abs(cima.y)).toBeLessThan(AMPLITUDE_MAX);
    const perto = direcaoAte(-32, 0);
    expect(Math.abs(perto.x)).toBeLessThan(0.1);
  });

  it('primeiro alvo é olhadela; clique repetido no mesmo lugar não mexe; alvo vizinho é ajuste', async () => {
    const { result } = renderHook(() => useAlvoDoOlhar(ref));
    const a = botaoEm(200, 100);
    await act(async () => { a.dispatchEvent(new Event('pointerdown', { bubbles: true })); await quadro(); });
    expect(result.current.modo).toBe('salto');
    expect(result.current.saltos).toBe(1);
    const primeiro = result.current.olhar;

    await act(async () => { a.dispatchEvent(new Event('pointerdown', { bubbles: true })); await quadro(); });
    expect(result.current.olhar).toBe(primeiro);

    const vizinho = botaoEm(500, 100);
    await act(async () => { vizinho.dispatchEvent(new Event('pointerdown', { bubbles: true })); await quadro(); });
    expect(result.current.modo).toBe('ajuste');
    expect(result.current.saltos).toBe(1);

    const outraRegiao = botaoEm(1000, 0);
    await act(async () => { outraRegiao.dispatchEvent(new Event('pointerdown', { bubbles: true })); await quadro(); });
    expect(result.current.modo).toBe('salto');
    expect(result.current.saltos).toBe(2);
  });

  it('solta o olhar (modo livre) depois de 3 s sem ação', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const { result } = renderHook(() => useAlvoDoOlhar(ref));
    const a = botaoEm(200, 100);
    act(() => { a.dispatchEvent(new Event('pointerdown', { bubbles: true })); vi.advanceTimersByTime(20); });
    expect(result.current.olhar).toBeDefined();
    act(() => { vi.advanceTimersByTime(SOLTA_OLHAR_MS - 100); });
    expect(result.current.olhar).toBeDefined();
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.olhar).toBeUndefined();
    expect(result.current.modo).toBe('livre');
  });

  it('senha: fecha enquanto o foco está em campos de senha (inclusive de um para outro) e abre ao sair', () => {
    const { result } = renderHook(() => useAlvoDoOlhar(ref));
    const [s1, s2] = [0, 1].map(() => {
      const c = document.createElement('input');
      c.type = 'password';
      document.body.appendChild(c);
      return c;
    });
    const nome = document.createElement('input');
    document.body.appendChild(nome);
    act(() => { s1.focus(); });
    expect(result.current.senha).toBe(true);
    act(() => { s2.focus(); });
    expect(result.current.senha).toBe(true);
    act(() => { nome.focus(); });
    expect(result.current.senha).toBe(false);
  });

  it('desligado não escuta nada', async () => {
    const { result } = renderHook(() => useAlvoDoOlhar(ref, false));
    const a = botaoEm(200, 100);
    await act(async () => { a.dispatchEvent(new Event('pointerdown', { bubbles: true })); await quadro(); });
    expect(result.current.olhar).toBeUndefined();
  });
});
