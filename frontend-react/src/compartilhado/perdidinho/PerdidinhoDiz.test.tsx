import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PerdidinhoDiz, SAIDA_MS } from './PerdidinhoDiz';

describe('PerdidinhoDiz', () => {
  afterEach(() => vi.useRealTimers());

  it('mostra título e texto numa região viva educada, com o Perdidinho decorativo', async () => {
    const { container } = render(<PerdidinhoDiz humor="dormindo" titulo="Nada por aqui" texto="Quando um carro entrar, a ficha aparece aqui." reduzirMovimento />);
    expect(screen.getByText('Nada por aqui')).toBeTruthy();
    const texto = screen.getByText('Quando um carro entrar, a ficha aparece aqui.');
    const viva = texto.closest('[aria-live]');
    expect(viva?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('pf-perdidinho-diz')?.hasAttribute('data-pronto')).toBe(true);
    expect(container.querySelector('.pdiz__mascote')?.getAttribute('aria-hidden')).toBe('true');
    // O mascote carrega sob demanda e entra decorativo (sem papel de imagem).
    const mascote = await waitFor(() => {
      const el = container.querySelector('pf-perdidinho');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(mascote.getAttribute('aria-hidden')).toBe('true');
    expect(mascote.getAttribute('data-humor')).toBe('dormindo');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('não rouba o foco ao aparecer', () => {
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    fora.focus();
    render(<PerdidinhoDiz humor="explicando" texto="Dica" aoFechar={() => {}} acao={{ rotulo: 'Ver', aoClicar: () => {} }} reduzirMovimento />);
    expect(document.activeElement).toBe(fora);
    fora.remove();
  });

  it('chama aoClicar da ação', () => {
    const aoClicar = vi.fn();
    render(<PerdidinhoDiz humor="apontando" texto="Abra uma ficha" acao={{ rotulo: 'Abrir ficha', aoClicar }} reduzirMovimento />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ficha' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('sem aoFechar não tem botão de fechar e Esc não faz nada', () => {
    render(<PerdidinhoDiz humor="explicando" texto="Fixo" reduzirMovimento />);
    expect(screen.queryByRole('button', { name: 'Fechar mensagem' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Fixo')).toBeTruthy();
  });

  it('fecha pelo botão (com reduzir movimento, na hora)', () => {
    const aoFechar = vi.fn();
    render(<PerdidinhoDiz humor="triste" texto="Sem conexão" aoFechar={aoFechar} reduzirMovimento />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sem conexão')).toBeNull();
  });

  it('fecha com Esc, mas não quando um diálogo modal está aberto', () => {
    const aoFechar = vi.fn();
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    render(<PerdidinhoDiz humor="surpreso" texto="Novidade" aoFechar={aoFechar} reduzirMovimento />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).not.toHaveBeenCalled();
    modal.remove();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Novidade')).toBeNull();
  });

  it('com movimento, faz a saída curta antes de fechar', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();
    const { container } = render(<PerdidinhoDiz humor="acenando" texto="Oi" aoFechar={aoFechar} />);
    expect(container.querySelector('[data-parado]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }));
    expect(container.querySelector('[data-saindo]')).not.toBeNull();
    expect(aoFechar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(SAIDA_MS); });
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(container.querySelector('pf-perdidinho-diz')).toBeNull();
  });

  it('respeita "reduzir movimento" do sistema (sem pop)', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    try {
      const { container } = render(<PerdidinhoDiz humor="comemorando" texto="Pronto!" />);
      expect(container.querySelector('[data-parado]')).not.toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it('posiciona o Perdidinho à direita quando pedido', () => {
    const { container } = render(<PerdidinhoDiz humor="pensando" texto="Hmm" lado="direita" tamanho={48} reduzirMovimento />);
    const raiz = container.querySelector('pf-perdidinho-diz') as HTMLElement;
    expect(raiz.getAttribute('data-lado')).toBe('direita');
    expect(raiz.style.getPropertyValue('--pdiz-tamanho')).toBe('48px');
  });
});
