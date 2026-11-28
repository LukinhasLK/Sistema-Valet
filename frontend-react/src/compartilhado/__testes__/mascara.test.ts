import { aplicarMascara, cpfValido, emailValido, telefoneValido } from '../mascara';

describe('mascara', () => {
  it('formata CPF enquanto digita', () => {
    expect(aplicarMascara('529', 'cpf')).toBe('529');
    expect(aplicarMascara('5299822', 'cpf')).toBe('529.982.2');
    expect(aplicarMascara('52998224725', 'cpf')).toBe('529.982.247-25');
    expect(aplicarMascara('529.982.247-2599', 'cpf')).toBe('529.982.247-25');
  });

  it('formata telefone fixo e celular', () => {
    expect(aplicarMascara('1133334444', 'telefone')).toBe('(11) 3333-4444');
    expect(aplicarMascara('11987654321', 'telefone')).toBe('(11) 98765-4321');
  });

  it('valida dígitos do CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });

  it('valida telefone com DDD', () => {
    expect(telefoneValido('(11) 98765-4321')).toBe(true);
    expect(telefoneValido('(11) 3333-4444')).toBe(true);
    expect(telefoneValido('9876-5432')).toBe(false);
  });

  it('valida e-mail como o Angular', () => {
    expect(emailValido('nome@email.com')).toBe(true);
    expect(emailValido('')).toBe(true);
    expect(emailValido('sem-arroba')).toBe(false);
  });
});
