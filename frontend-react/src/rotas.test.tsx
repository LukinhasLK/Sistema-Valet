import { render, screen, waitFor } from '@testing-library/react';
import { SemConexao } from './rotas';

describe('tela sem conexão', () => {
  it('mostra o Perdidinho triste com a frase e fica pensando ao tentar de novo', async () => {
    const { container } = render(<SemConexao />);
    expect(screen.getByRole('heading', { name: 'Sem conexão com o servidor' })).toBeTruthy();
    await waitFor(() => expect(container.querySelector('pf-perdidinho-diz')?.getAttribute('data-humor')).toBe('triste'));
    expect(screen.getByText('Seu login continua salvo neste aparelho. Confira a internet e tente de novo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});
