import { formatarData } from '../nucleo/servicos/periodo';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMERO = new Intl.NumberFormat('pt-BR');

/** `1234.5` → `R$ 1.234,50`. */
export const moeda = (valor: number | null | undefined) => MOEDA.format(valor ?? 0);

/** `2246` → `2.246`. */
export const numero = (valor: number | null | undefined) => NUMERO.format(valor ?? 0);

/** `2026-06-07` → `07/06/2026`. */
export const dataBr = (dataIso: string | null | undefined) => (dataIso ? formatarData(dataIso) : '—');

type Formato = 'dd/MM/yyyy HH:mm' | 'dd/MM HH:mm' | 'MM/yyyy';

/**
 * Equivalente ao pipe `date` do Angular nos formatos usados no sistema.
 * `fuso`: '-0300' (horário de Brasília fixo), 'UTC' ou omitido (fuso do navegador).
 */
export function dataHora(valor: string | null | undefined, formato: Formato, fuso?: '-0300' | 'UTC'): string {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const deslocado = fuso === '-0300' ? new Date(data.getTime() - 3 * 3600_000) : data;
  const utc = fuso !== undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  const dia = p(utc ? deslocado.getUTCDate() : deslocado.getDate());
  const mes = p((utc ? deslocado.getUTCMonth() : deslocado.getMonth()) + 1);
  const ano = utc ? deslocado.getUTCFullYear() : deslocado.getFullYear();
  const hora = p(utc ? deslocado.getUTCHours() : deslocado.getHours());
  const minuto = p(utc ? deslocado.getUTCMinutes() : deslocado.getMinutes());
  if (formato === 'MM/yyyy') return `${mes}/${ano}`;
  if (formato === 'dd/MM HH:mm') return `${dia}/${mes} ${hora}:${minuto}`;
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}
