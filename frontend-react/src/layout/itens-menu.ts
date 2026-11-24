import { NivelAcesso } from '../nucleo/modelos';
import { podeAcessar } from '../nucleo/servicos/permissoes';

export interface NavItem {
  label: string;
  rota: string;
  icone: string;
}

/** Menu completo — usado na sidebar do desktop e no "Mais" do mobile. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', rota: '/app/dashboard', icone: 'dashboard' },
  { label: 'Notificações', rota: '/app/notificacoes', icone: 'sino' },
  { label: 'Fichas', rota: '/app/fichas', icone: 'fichas' },
  { label: 'Relatórios', rota: '/app/relatorios', icone: 'relatorios' },
  { label: 'Manobristas', rota: '/app/manobristas', icone: 'manobristas' },
  { label: 'Pagamentos de Manobristas', rota: '/app/pagamentos-manobristas', icone: 'lucro' },
  { label: 'Divisão de Lucro', rota: '/app/divisao-lucro', icone: 'lucro' },
  { label: 'Despesas', rota: '/app/despesas', icone: 'despesas' },
  { label: 'Carros por Mês', rota: '/app/carros-por-mes', icone: 'carros' },
  { label: 'Eventos', rota: '/app/eventos', icone: 'carros' },
  { label: 'Escalas', rota: '/app/escalas', icone: 'manobristas' },
  { label: 'Unidades', rota: '/app/unidades', icone: 'unidades' },
  { label: 'Sócios', rota: '/app/socios', icone: 'socios' },
  { label: 'Usuários', rota: '/app/usuarios', icone: 'usuarios' },
];

/** Os quatro atalhos fixos da barra inferior; o quinto item é o "Mais". */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Início', rota: '/app/dashboard', icone: 'dashboard' },
  { label: 'Fichas', rota: '/app/fichas', icone: 'fichas' },
  { label: 'Lucro', rota: '/app/divisao-lucro', icone: 'lucro' },
  { label: 'Despesas', rota: '/app/despesas', icone: 'despesas' },
];

export const PERFIL_ITEM: NavItem = { label: 'Meu perfil', rota: '/app/perfil', icone: 'usuarios' };

/** Itens que o nível do usuário pode ver (mesma regra do roleGuard). */
export function itensPermitidos(itens: NavItem[], nivel: NivelAcesso | null): NavItem[] {
  return itens.filter((item) => podeAcessar(nivel, item.rota.replace('/app/', '')));
}

/** Cor determinística do avatar a partir do nome. */
const CORES_AVATAR = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

export function corDoAvatar(nome: string): string {
  const soma = [...nome].reduce((total, char) => total + char.charCodeAt(0), 0);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}
