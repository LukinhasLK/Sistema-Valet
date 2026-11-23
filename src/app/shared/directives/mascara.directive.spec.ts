import { FormControl } from '@angular/forms';
import { aplicarMascara, cpfValido, telefoneValido } from './mascara.directive';

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
    expect(cpfValido(new FormControl('529.982.247-25'))).toBeNull();
    expect(cpfValido(new FormControl(''))).toBeNull();
    expect(cpfValido(new FormControl('529.982.247-26'))).toEqual({ cpf: true });
    expect(cpfValido(new FormControl('111.111.111-11'))).toEqual({ cpf: true });
  });

  it('valida telefone com DDD', () => {
    expect(telefoneValido(new FormControl('(11) 98765-4321'))).toBeNull();
    expect(telefoneValido(new FormControl('(11) 3333-4444'))).toBeNull();
    expect(telefoneValido(new FormControl('9876-5432'))).toEqual({ telefone: true });
  });
});
