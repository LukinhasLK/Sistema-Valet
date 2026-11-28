import { create } from 'zustand';
import { CategoriaDespesa, Despesa, HistoricoDespesa } from '../modelos';
import { api } from '../servicos/api';
import { round2 } from '../servicos/calc';
import { Filtro, noPeriodo } from '../servicos/periodo';

const URL = '/despesas';

export const TODAS_CATEGORIAS = 'Todas';

/** Cor do badge de cada categoria. */
export const CLASSE_CATEGORIA: Record<CategoriaDespesa, string> = {
  Seguro: 'pf-badge--blue',
  'Manutenção': 'pf-badge--orange',
  Aluguel: 'pf-badge--purple',
  Outros: 'pf-badge--gray',
};

export const useDespesas = create<{ despesas: Despesa[] }>(() => ({ despesas: [] }));

export function filtrarDespesas(despesas: Despesa[], filtro: Filtro & { categoria?: string; canceladas?: boolean }): Despesa[] {
  return despesas
    .filter((despesa) => !!despesa.cancelada === !!filtro.canceladas && noPeriodo(despesa, filtro))
    .filter((despesa) => !filtro.categoria || filtro.categoria === TODAS_CATEGORIAS || despesa.categoria === filtro.categoria)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
}

export const totalDespesas = (despesas: Despesa[]) => round2(despesas.reduce((soma, d) => soma + d.valor, 0));

export const despesasServico = {
  async carregar() {
    useDespesas.setState({ despesas: await api.get<Despesa[]>(URL) });
  },
  limpar() {
    useDespesas.setState({ despesas: [] });
  },
  async adicionar(despesa: Omit<Despesa, 'id'>) {
    const salva = await api.post<Despesa>(URL, despesa);
    useDespesas.setState(({ despesas }) => ({ despesas: [salva, ...despesas] }));
    return salva;
  },
  async atualizar(despesa: Despesa) {
    const salva = await api.put<Despesa>(`${URL}/${despesa.id}`, despesa);
    useDespesas.setState(({ despesas }) => ({ despesas: despesas.map((d) => (d.id === salva.id ? salva : d)) }));
    return salva;
  },
  usaUnidade: (unidadeId: number) => useDespesas.getState().despesas.some((d) => d.unidadeId === unidadeId),
  async cancelar(id: number, justificativa: string) {
    const cancelada = await api.post<Despesa>(`${URL}/${id}/cancelamento`, { justificativa });
    useDespesas.setState(({ despesas }) => ({ despesas: despesas.map((d) => (d.id === id ? cancelada : d)) }));
  },
  historico: (id: number) => api.get<HistoricoDespesa[]>(`${URL}/${id}/historico`),
};
