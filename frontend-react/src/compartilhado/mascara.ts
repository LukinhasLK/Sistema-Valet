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

/** CPF com dígitos verificadores válidos (campo vazio é aceito). */
export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (!d) return true;
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

/** Telefone com DDD: 10 (fixo) ou 11 (celular) dígitos. */
export function telefoneValido(valor: string): boolean {
  const d = soDigitos(valor);
  return !d || d.length === 10 || d.length === 11;
}

/** Mesma regra do Validators.email do Angular (vazio é tratado pelo "obrigatório"). */
const EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const emailValido = (valor: string) => !valor || EMAIL.test(valor);
