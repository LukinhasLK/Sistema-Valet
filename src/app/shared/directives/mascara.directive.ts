import { Directive, HostListener, inject, input } from '@angular/core';
import { AbstractControl, NgControl, ValidationErrors } from '@angular/forms';

export type TipoMascara = 'cpf' | 'telefone';

const soDigitos = (valor: string) => (valor ?? '').replace(/\D/g, '');

export function aplicarMascara(valor: string, tipo: TipoMascara): string {
  const d = soDigitos(valor);
  if (tipo === 'cpf') {
    return d
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  const t = d.slice(0, 11);
  if (t.length <= 2) return t.length ? `(${t}` : '';
  if (t.length <= 6) return `(${t.slice(0, 2)}) ${t.slice(2)}`;
  if (t.length <= 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
}

/** CPF com dígitos verificadores válidos (campo vazio é aceito; use `required` se for obrigatório). */
export function cpfValido(controle: AbstractControl): ValidationErrors | null {
  const d = soDigitos(controle.value);
  if (!d) return null;
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return { cpf: true };
  const digito = (base: string) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const ok = digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
  return ok ? null : { cpf: true };
}

/** Telefone com DDD: 10 (fixo) ou 11 (celular) dígitos. */
export function telefoneValido(controle: AbstractControl): ValidationErrors | null {
  const d = soDigitos(controle.value);
  return !d || d.length === 10 || d.length === 11 ? null : { telefone: true };
}

/** Formata CPF/telefone enquanto o usuário digita. Uso: `<input pfMascara="cpf" formControlName="cpf">`. */
@Directive({ selector: 'input[pfMascara]', standalone: true })
export class MascaraDirective {
  readonly pfMascara = input.required<TipoMascara>();
  private readonly controle = inject(NgControl, { self: true });

  @HostListener('input', ['$event.target.value'])
  aoDigitar(valor: string): void {
    this.controle.control?.setValue(aplicarMascara(valor, this.pfMascara()), { emitEvent: true });
  }
}
