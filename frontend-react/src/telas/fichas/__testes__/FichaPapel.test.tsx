import { render, waitFor } from '@testing-library/react';
import { Ficha } from '../../../nucleo/modelos';
import { FichaPapel } from '../FichaPapel';

const ficha = {
  id: 7, data: '2026-11-20', unidadeId: 1, turno: 'dia', fichaInicio: 1, fichaFim: 10, fichasCanceladas: 0,
  totalCarros: 10, valorDinheiro: 100, valorCartao: 0, taxaMaquininha: 0, manobristas: [], despesasAdicionais: [],
  totalBruto: 100, totalLiquido: 100,
} as Ficha;

describe('FichaPapel: Perdidinho do fechamento', () => {
  it('não mostra o Perdidinho com a ficha aberta', () => {
    const { container } = render(<FichaPapel ficha={ficha} unidade="Centro" fechada={false} />);
    expect(container.querySelector('.papel__mascote')).toBeNull();
  });

  it('mostra o Perdidinho comemorando, decorativo, fora dos valores, quando a ficha fecha', async () => {
    const { container, rerender } = render(<FichaPapel ficha={ficha} unidade="Centro" fechada={false} />);
    rerender(<FichaPapel ficha={ficha} unidade="Centro" fechada />);
    const slot = container.querySelector('.papel__mascote')!;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.papel__topo')!.contains(slot)).toBe(true);
    expect(container.querySelector('.papel__linhas')!.contains(slot)).toBe(false);
    await waitFor(() => expect(slot.querySelector('pf-perdidinho')?.getAttribute('data-humor')).toBe('comemorando'));
  });

  it('com mascote={false}, a ficha fecha sem Perdidinho', () => {
    const { container } = render(<FichaPapel ficha={ficha} unidade="Centro" fechada mascote={false} />);
    expect(container.querySelector('.papel--fechada')).not.toBeNull();
    expect(container.querySelector('.papel__mascote')).toBeNull();
  });
});
