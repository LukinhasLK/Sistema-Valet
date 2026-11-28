export type CategoriaDespesa = 'Seguro' | 'Manutenção' | 'Aluguel' | 'Outros';

export const CATEGORIAS_DESPESA: CategoriaDespesa[] = ['Seguro', 'Manutenção', 'Aluguel', 'Outros'];

export interface Despesa {
  id: number;
  data: string;
  unidadeId: number;
  categoria: CategoriaDespesa;
  descricao: string;
  valor: number;
  cancelada?: boolean;
}

export interface HistoricoDespesa {
  id: number;
  acao: string;
  ator: string;
  registradoEm: string;
  descricao: string;
  valor: number;
  justificativa: string | null;
}
