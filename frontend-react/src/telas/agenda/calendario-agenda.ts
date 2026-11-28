/** Lógica de datas do calendário da agenda (sem React, para testar isoladamente). */

export interface ItemDatado {
  inicio: string; // "2026-11-24T19:00[:00]"
  fim: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 42 dias (6 semanas, começando no domingo) que cobrem o mês. `mes` de 1 a 12. */
export function gradeDoMes(ano: number, mes: number): string[] {
  const primeiro = new Date(ano, mes - 1, 1, 12);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return iso(d);
  });
}

/** Dias (AAAA-MM-DD) em que o item acontece. Termina à meia-noite exata? Não conta o dia seguinte. */
export function diasDoItem(item: ItemDatado): string[] {
  const inicio = item.inicio.slice(0, 10);
  let fim = item.fim.slice(0, 10);
  if (fim > inicio && /T00:00(:00)?/.test(item.fim)) {
    const d = new Date(`${fim}T12:00:00`);
    d.setDate(d.getDate() - 1);
    fim = iso(d);
  }
  if (fim < inicio) fim = inicio;
  const dias: string[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  for (let i = 0; i < 62 && iso(d) <= fim; i++) {
    dias.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

/** Itens por dia, em ordem de horário de início. */
export function itensPorDia<T extends ItemDatado>(itens: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of [...itens].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    for (const dia of diasDoItem(item)) mapa.set(dia, [...(mapa.get(dia) ?? []), item]);
  }
  return mapa;
}

export const hoje = () => iso(new Date());
