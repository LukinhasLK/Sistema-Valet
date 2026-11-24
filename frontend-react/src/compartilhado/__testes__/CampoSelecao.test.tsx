import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { CampoSelecao } from '../CampoSelecao';

function Formulario({ aoMudar }: { aoMudar: (v: string) => void }) {
  const [valor, setValor] = useState('');
  return (
    <>
      <label htmlFor="unidade">Unidade</label>
      <CampoSelecao id="unidade" name="unidade" value={valor} onChange={(e) => { setValor(e.target.value); aoMudar(e.target.value); }}>
        <option value="" disabled>Selecione a unidade</option>
        {[{ id: 1, nome: 'Centro' }, { id: 2, nome: 'Arena' }].map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </CampoSelecao>
    </>
  );
}

describe('CampoSelecao', () => {
  it('mostra o placeholder, abre a lista com o nome do rótulo e escolhe pelo clique', () => {
    const aoMudar = vi.fn();
    render(<Formulario aoMudar={aoMudar} />);
    const botao = screen.getByRole('button', { name: /^Unidade:/ });
    expect(botao.textContent).toBe('Selecione a unidade');
    fireEvent.click(botao);
    const lista = screen.getByRole('listbox', { name: 'Unidade' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Centro', 'Arena']);
    fireEvent.click(screen.getByRole('option', { name: 'Arena' }));
    expect(aoMudar).toHaveBeenCalledWith('2');
    expect(botao.textContent).toBe('Arena');
    expect(lista.isConnected).toBe(true); // a saída é animada; o valor já foi aplicado
  });

  it('funciona pelo teclado: seta para baixo abre, setas navegam e Enter escolhe', () => {
    const aoMudar = vi.fn();
    render(<Formulario aoMudar={aoMudar} />);
    const botao = screen.getByRole('button', { name: /^Unidade:/ });
    fireEvent.keyDown(botao, { key: 'ArrowDown' });
    const lista = screen.getByRole('listbox');
    fireEvent.keyDown(lista, { key: 'ArrowDown' });
    fireEvent.keyDown(lista, { key: 'Enter' });
    expect(aoMudar).toHaveBeenCalledWith('2');
  });

  it('mantém o <select> real no formulário (nome e valor)', () => {
    render(<Formulario aoMudar={() => undefined} />);
    const nativo = document.querySelector<HTMLSelectElement>('select[name="unidade"]')!;
    expect(nativo.id).toBe('unidade');
    fireEvent.change(nativo, { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /^Unidade:/ }).textContent).toBe('Centro');
  });
});
