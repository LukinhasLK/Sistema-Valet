import { NivelAcesso } from '../modelos';

/** Quem trabalha na operação. O Sócio só consulta a própria sociedade. */
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
  sociedade: ['Proprietário', 'Sócio'],
  /** Atalho da barra inferior do celular, só para o sócio (o proprietário chega pelo menu). */
  'sociedade-atalho': ['Sócio'],
  perfil: [...TODOS, 'Sócio'],
};

export function podeAcessar(nivel: NivelAcesso | null | undefined, rota: string): boolean {
  const niveis = PERMISSOES[rota];
  return !!nivel && !!niveis?.includes(nivel);
}

/** Tela inicial de cada nível após o login. */
export function rotaInicial(nivel: NivelAcesso | null | undefined): string {
  if (nivel === 'Sócio') return '/app/sociedade';
  return podeAcessar(nivel, 'dashboard') ? '/app/dashboard' : '/app/fichas';
}
