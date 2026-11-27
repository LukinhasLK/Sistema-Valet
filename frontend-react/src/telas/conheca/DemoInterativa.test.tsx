import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import DemoInterativa from './DemoInterativa';

const montar = () => render(<StrictMode><MemoryRouter><DemoInterativa /></MemoryRouter></StrictMode>);
const clicar = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const titulo = (n: number, texto: string) => screen.getByRole('heading', { name: `Etapa ${n} de 4 · ${texto}` });

describe('DemoInterativa', () => {
  it('não rouba o foco ao montar e começa no passo 1 com o envio desabilitado', () => {
    const { container } = montar();
    expect(document.activeElement).toBe(document.body);
    expect(titulo(1, 'Lance o turno')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar para conferência' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Lance o turno');
  });

  it('1342 dá 140 carros; valor inválido desabilita o envio', () => {
    const { container } = montar();
    clicar('Preencher para mim');
    expect(container.querySelector('output')?.textContent).toBe('140');
    expect((screen.getByRole('button', { name: 'Enviar para conferência' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Ticket final'), { target: { value: '1100' } });
    expect((screen.getByRole('button', { name: 'Enviar para conferência' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('O ticket final precisa ser maior que o inicial.').length).toBeGreaterThan(0);
  });

  it('devolver volta ao passo 1 com a faixa de motivo', () => {
    const { container } = montar();
    clicar('Preencher para mim'); clicar('Enviar para conferência');
    titulo(2, 'Confira como gestor');
    clicar('Devolver ao operador');
    titulo(1, 'Lance o turno');
    expect(container.querySelector('.demo__faixa-devolvida')?.textContent).toContain('Devolvida: ticket final não confere');
  });

  it('fluxo completo: enviar, conferir, fechar, pagar 2 e recomeçar com foco no título', () => {
    const { container } = montar();
    clicar('Preencher para mim'); clicar('Enviar para conferência');
    clicar('Conferir');
    expect(document.activeElement).toBe(titulo(3, 'Feche o caixa'));
    clicar('Fechar caixa');
    expect(container.querySelector('.papel--fechada')).not.toBeNull();
    expect(container.querySelector('.papel__mascote')).toBeNull();
    expect(container.querySelectorAll('.demo__historico li').length).toBe(3);
    expect(screen.queryByLabelText('Ticket final')).toBeNull();
    clicar('Ir para o pagamento');
    expect(document.activeElement).toBe(titulo(4, 'Pague a equipe'));
    expect(container.querySelector('.demo__fim')).toBeNull();
    const pagar = screen.getAllByRole('button', { name: 'Marcar como pago' });
    expect(pagar.length).toBe(2);
    fireEvent.click(pagar[0]);
    expect(container.querySelector('.demo__guia')?.textContent).toContain('Pago. Falta 1 diária.');
    fireEvent.click(pagar[1]);
    expect(container.querySelector('.demo__guia')?.textContent).toContain('Tudo registrado, do turno ao pagamento.');
    expect(screen.getAllByRole('link', { name: /Ver planos/ })[0].className).toContain('pf-btn--primary');
    expect(container.querySelector('.demo__fim')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Ver planos/ }).getAttribute('href')).toBe('/planos');
    clicar('Recomeçar');
    const t1 = titulo(1, 'Lance o turno');
    expect(document.activeElement).toBe(t1);
    expect((screen.getByLabelText('Ticket final') as HTMLInputElement).value).toBe('');
    expect(container.querySelector('.demo__palco')?.getAttribute('data-estado')).toBe('inicio');
  });

  it('mostra o selo de dados fictícios e a nota de cálculo no resumo', () => {
    const { container } = montar();
    expect(container.querySelector('.demo__selo')?.textContent).toBe('Demonstração · dados fictícios');
    clicar('Preencher para mim'); clicar('Enviar para conferência');
    const nota = container.querySelector('.demo__resumo-nota')?.textContent ?? '';
    expect(nota).toMatch(/3\.000,00.*recebimentos menos.*300,00.*diárias e despesas/);
  });

  it('anuncia o total só depois de 500 ms', () => {
    vi.useFakeTimers();
    try {
      const { container } = montar();
      clicar('Preencher para mim');
      const vivo = () => container.querySelector('.pf-sr-only[role="status"]')?.textContent ?? '';
      expect(vivo()).not.toContain('140');
      act(() => { vi.advanceTimersByTime(500); });
      expect(vivo()).toContain('Total: 140 carros');
    } finally { vi.useRealTimers(); }
  });
});
