import { NivelAcesso } from '../modelos';

const TODOS: NivelAcesso[] = ['Proprietário', 'Gerente', 'Operador'];
const GESTAO: NivelAcesso[] = ['Proprietário', 'Gerente'];
const PROPRIETARIO: NivelAcesso[] = ['Proprietário'];

/** Quem pode acessar cada rota de /app (mesma regra para menu e roleGuard). */
export const PERMISSOES: Record<string, NivelAcesso[]> = {
  dashboard: GESTAO,
  notificacoes: GESTAO,
  fichas: TODOS,
  'fichas/nova': TODOS,
  'fichas/:id/editar': GESTAO,
  relatorios: GESTAO,
  manobristas: TODOS,
  'pagamentos-manobristas': GESTAO,
  'divisao-lucro': PROPRIETARIO,
  despesas: GESTAO,
  'carros-por-mes': GESTAO,
  unidades: PROPRIETARIO,
  eventos: GESTAO,
  escalas: GESTAO,
  socios: PROPRIETARIO,
  usuarios: PROPRIETARIO,
  perfil: TODOS,
};

export function podeAcessar(nivel: NivelAcesso | null | undefined, rota: string): boolean {
  const niveis = PERMISSOES[rota];
  return !!nivel && !!niveis?.includes(nivel);
}

/** Tela inicial de cada nível após o login. */
export function rotaInicial(nivel: NivelAcesso | null | undefined): string {
  return podeAcessar(nivel, 'dashboard') ? '/app/dashboard' : '/app/fichas';
}
