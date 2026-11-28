import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../../nucleo/estado/auth';
import { interfaceServico } from '../../nucleo/estado/interface';
import { combina, normalizar, PaletaComandos } from '../PaletaComandos';

describe('paleta de comandos', () => {
  afterEach(() => { interfaceServico.fecharPaleta(); useAuth.setState({ usuario: null, token: null }); });

  it('busca sem acento e com todas as palavras', () => {
    expect(normalizar('Relatórios')).toBe('relatorios');
    expect(combina('relat', 'Relatórios Financeiro')).toBe(true);
    expect(combina('pagar pix', 'Pagamentos pendentes pagar diárias pix')).toBe(true);
    expect(combina('pagar boleto', 'Pagamentos pendentes pagar diárias pix')).toBe(false);
  });

  it('abre com Ctrl+K e mostra só as telas permitidas ao operador', () => {
    useAuth.setState({ usuario: { id: 3, nome: 'Dario', email: 'd@x.com', nivel: 'Operador' }, token: 't' });
    render(<MemoryRouter><PaletaComandos /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Paleta de comandos' })).toBeTruthy();
    const opcoes = screen.getAllByRole('option').map((o) => o.textContent);
    expect(opcoes.some((t) => t?.startsWith('Fichas'))).toBe(true);
    expect(opcoes.some((t) => t?.includes('Nova ficha'))).toBe(true);
    expect(opcoes.some((t) => t?.startsWith('Relatórios'))).toBe(false);
    expect(opcoes.some((t) => t?.startsWith('Usuários'))).toBe(false);
    expect(opcoes.some((t) => t?.includes('Pagamentos pendentes'))).toBe(false);
  });

  it('filtra pelo texto e mostra uma mensagem quando nada combina', () => {
    useAuth.setState({ usuario: { id: 1, nome: 'Lucas', email: 'l@x.com', nivel: 'Proprietário' }, token: 't' });
    render(<MemoryRouter><PaletaComandos /></MemoryRouter>);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const campo = screen.getByRole('combobox');
    fireEvent.change(campo, { target: { value: 'despesas' } });
    expect(screen.getAllByRole('option')[0].textContent).toContain('Despesas');
    fireEvent.change(campo, { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nada encontrado/)).toBeTruthy();
  });
});
