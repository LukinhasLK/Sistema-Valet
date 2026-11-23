export type NivelAcesso = 'Proprietário' | 'Gerente' | 'Operador';

export const NIVEIS_ACESSO: NivelAcesso[] = ['Proprietário', 'Gerente', 'Operador'];

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  ativo?: boolean;
  unidadeIds?: number[];
  /** Só existe no modo demonstração (localStorage); no back end fica com hash BCrypt. */
  senha?: string;
}
