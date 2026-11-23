export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
] as const;

/** Valor do filtro de unidade que representa "todas as unidades". */
export const TODAS_UNIDADES = 0;

/** Data de hoje no fuso local (`toISOString` usa UTC e vira o dia após as 21h no Brasil). */
export function hojeIso(agora = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export interface Periodo {
  mes: number;
  ano: number;
}

export interface Filtro {
  /** 0 = todos os meses. */
  mes: number;
  ano: number;
  /** `TODAS_UNIDADES` (0) = todas. */
  unidadeId: number;
  busca?: string;
}

/** Datas são ISO (`YYYY-MM-DD`) para ordenar e filtrar sem fuso horário. */
export function mesDe(dataIso: string): number {
  return Number(dataIso.slice(5, 7));
}

export function anoDe(dataIso: string): number {
  return Number(dataIso.slice(0, 4));
}

export function diaDe(dataIso: string): number {
  return Number(dataIso.slice(8, 10));
}

/** `2026-06-07` → `07/06/2026`. */
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** `07/06/2026` → `2026-06-07`. */
export function paraIso(dataBr: string): string {
  const [dia, mes, ano] = dataBr.split('/');
  return `${ano}-${mes}-${dia}`;
}

export function diaDaSemana(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
}

export function rotuloPeriodo(mes: number, ano: number): string {
  return mes === 0 ? `Ano de ${ano}` : `${MESES[mes - 1]} de ${ano}`;
}

/** Aplica mês/ano/unidade a qualquer registro datado. */
export function noPeriodo(registro: { data: string; unidadeId: number }, filtro: Filtro): boolean {
  if (anoDe(registro.data) !== filtro.ano) return false;
  if (filtro.mes !== 0 && mesDe(registro.data) !== filtro.mes) return false;
  if (filtro.unidadeId !== TODAS_UNIDADES && registro.unidadeId !== filtro.unidadeId) return false;
  return true;
}
