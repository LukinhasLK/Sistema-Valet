export interface PercentualUnidade {
  unidadeId: number;
  percentual: number;
}

export interface Socio {
  id: number;
  nome: string;
  percentuais: PercentualUnidade[];
}
