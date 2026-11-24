import { fireEvent, render, screen } from '@testing-library/react';
import { useFormulario } from '../useFormulario';

function Formulario() {
  const f = useFormulario({ nome: '', idade: null as number | null }, (v) => ({ nome: !v.nome }));
  return (
    <>
      <input aria-label="nome" {...f.campo('nome')} />
      <input aria-label="idade" {...f.numero('idade')} />
      <span data-testid="estado">{JSON.stringify(f.valores)}</span>
    </>
  );
}

test('digitar atualiza os valores', () => {
  render(<Formulario />);
  fireEvent.change(screen.getByLabelText('nome'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('idade'), { target: { value: '42' } });
  expect(screen.getByTestId('estado').textContent).toBe('{"nome":"Ana","idade":42}');
});
