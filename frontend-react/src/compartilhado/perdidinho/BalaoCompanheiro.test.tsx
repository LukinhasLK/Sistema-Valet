import { act, fireEvent, render, screen } from '@testing-library/react';
import { BalaoCompanheiro, FOLGA_MS, SAIDA_BALAO_MS, SAIDA_BALAO_REDUZIDA_MS } from './BalaoCompanheiro';

describe('BalaoCompanheiro', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const passar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('mostra o texto numa região role=status educada, sem tomar o foco', () => {
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    fora.focus();
    const { container } = render(<BalaoCompanheiro variante="faixa" texto="Ontem: 42 carros, R$ 1.260,00." aoFechar={() => {}} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Ontem: 42 carros, R$ 1.260,00.');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('pf-balao-companheiro')?.getAttribute('data-variante')).toBe('faixa');
    expect(document.activeElement).toBe(fora);
    fora.remove();
  });

  it('na barra do desktop o texto é só visual: a região viva é única e mora no Perdidinho (sem anúncio duplo)', () => {
    const { container } = render(<BalaoCompanheiro variante="barra" texto="Ontem: 42 carros." aoFechar={() => {}} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(container.querySelector('.balc__texto')?.textContent).toBe('Ontem: 42 carros.');
    expect(container.querySelector('pf-balao-companheiro')?.getAttribute('data-variante')).toBe('barra');
  });

  it('a faixa do celular também é status e tem ícone decorativo', () => {
    const { container } = render(<BalaoCompanheiro variante="faixa" texto="Você começou uma ficha às 9:10." aoFechar={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('Você começou uma ficha');
    expect(container.querySelector('.balc__icone')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('o X chama aoFechar("fechar") depois da saída e desmonta', () => {
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="barra" texto="Recado" aoFechar={aoFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }));
    expect(aoFechar).not.toHaveBeenCalled();
    passar(SAIDA_BALAO_MS);
    expect(aoFechar.mock.calls).toEqual([['fechar']]);
    expect(screen.queryByText('Recado')).toBeNull();
  });

  it('Esc chama aoFechar("fechar"), mas não com outro diálogo modal aberto', () => {
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="faixa" texto="Recado" aoFechar={aoFechar} reduzirMovimento />);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    fireEvent.keyDown(document, { key: 'Escape' });
    passar(SAIDA_BALAO_MS);
    expect(aoFechar).not.toHaveBeenCalled();
    modal.remove();
    fireEvent.keyDown(document, { key: 'Escape' });
    passar(SAIDA_BALAO_REDUZIDA_MS);
    expect(aoFechar.mock.calls).toEqual([['fechar']]);
  });

  it('tempo esgotado chama aoFechar("tempo")', () => {
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="barra" texto="Recado" aoFechar={aoFechar} />);
    passar(9999); // barra: 10 s
    expect(aoFechar).not.toHaveBeenCalled();
    passar(1 + SAIDA_BALAO_MS);
    expect(aoFechar.mock.calls).toEqual([['tempo']]);
  });

  it('duracaoMs=0 não fecha sozinho', () => {
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="barra" texto="Recado" aoFechar={aoFechar} duracaoMs={0} />);
    passar(60_000);
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('hover pausa o tempo; ao sair, retoma com folga para terminar de ler', () => {
    const aoFechar = vi.fn();
    const { container } = render(<BalaoCompanheiro variante="barra" texto="Recado" aoFechar={aoFechar} duracaoMs={4000} />);
    const raiz = container.querySelector('pf-balao-companheiro')!;
    passar(3500);
    fireEvent.mouseEnter(raiz);
    expect(raiz.hasAttribute('data-pausado')).toBe(true);
    passar(20_000);
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.mouseLeave(raiz);
    passar(FOLGA_MS - 1);
    expect(aoFechar).not.toHaveBeenCalled();
    passar(1 + SAIDA_BALAO_MS);
    expect(aoFechar.mock.calls).toEqual([['tempo']]);
  });

  it('foco dentro pausa o tempo', () => {
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="faixa" texto="Recado" aoFechar={aoFechar} duracaoMs={2000} />);
    act(() => screen.getByRole('button', { name: 'Fechar mensagem' }).focus());
    passar(10_000);
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('a ação chama aoClicar e depois aoFechar("acao")', () => {
    const aoClicar = vi.fn();
    const aoFechar = vi.fn();
    render(<BalaoCompanheiro variante="faixa" texto="Ficha de Centro às 9:10." acao={{ rotulo: 'Continuar ficha', aoClicar }} aoFechar={aoFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar ficha' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
    passar(SAIDA_BALAO_MS);
    expect(aoFechar.mock.calls).toEqual([['acao']]);
  });

  it('se quem chama desmontar durante a saída (a ação navegou), o motivo não se perde', () => {
    const aoFechar = vi.fn();
    const { unmount } = render(<BalaoCompanheiro variante="barra" texto="Recado" acao={{ rotulo: 'Ver', aoClicar: () => {} }} aoFechar={aoFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    unmount();
    expect(aoFechar.mock.calls).toEqual([['acao']]);
  });
});
