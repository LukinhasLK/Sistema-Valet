export type NivelAcesso = 'Proprietário' | 'Gerente' | 'Operador' | 'Sócio';

export const NIVEIS_ACESSO: NivelAcesso[] = ['Proprietário', 'Gerente', 'Operador', 'Sócio'];

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  ativo?: boolean;
  unidadeIds?: number[];
  /** Só no nível Sócio: qual sócio este login representa. */
  socioId?: number | null;
  /** Só existe no modo demonstração (localStorage); no back end fica com hash BCrypt. */
  senha?: string;
}
