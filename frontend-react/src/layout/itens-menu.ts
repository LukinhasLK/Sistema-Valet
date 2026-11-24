import { NivelAcesso } from '../nucleo/modelos';
import { podeAcessar } from '../nucleo/servicos/permissoes';

export interface NavItem {
  label: string;
  rota: string;
  icone: string;
  /** Palavras extras para a busca da paleta de comandos. */
  termos?: string;
  /** Chave de PERMISSOES, quando difere da rota (atalhos exclusivos de um nível). */
  permissao?: string;
}

export interface GrupoMenu {
  id: string;
  titulo: string;
  itens: NavItem[];
}

/**
 * Menu agrupado por contexto de trabalho. São os mesmos 14 itens de antes, com as mesmas
 * rotas; quem decide o que cada nível vê continua sendo `PERMISSOES` (permissoes.ts).
 */
export const GRUPOS_MENU: GrupoMenu[] = [
  {
    id: 'inicio',
    titulo: 'Início',
    itens: [
      { label: 'Dashboard', rota: '/app/dashboard', icone: 'dashboard', termos: 'painel visão geral início resumo' },
      { label: 'Notificações', rota: '/app/notificacoes', icone: 'sino', termos: 'alertas avisos push' },
    ],
  },
  {
    id: 'operacao',
    titulo: 'Operação',
    itens: [
      { label: 'Fichas', rota: '/app/fichas', icone: 'fichas', termos: 'caixa fechamento tickets controle de veículos' },
      { label: 'Carros por Mês', rota: '/app/carros-por-mes', icone: 'carros', termos: 'veículos movimento quantidade' },
      { label: 'Eventos', rota: '/app/eventos', icone: 'eventos', termos: 'agenda festa evento' },
      { label: 'Escalas', rota: '/app/escalas', icone: 'escalas', termos: 'agenda turnos plantão' },
    ],
  },
  {
    id: 'equipe',
    titulo: 'Equipe',
    itens: [
      { label: 'Manobristas', rota: '/app/manobristas', icone: 'manobristas', termos: 'equipe valet funcionários' },
      { label: 'Pagamentos de Manobristas', rota: '/app/pagamentos-manobristas', icone: 'pagamentos', termos: 'diárias pix pendentes pagar' },
    ],
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    itens: [
      { label: 'Relatórios', rota: '/app/relatorios', icone: 'relatorios', termos: 'pdf exportar mensal' },
      { label: 'Despesas', rota: '/app/despesas', icone: 'despesas', termos: 'custos gastos contas' },
      { label: 'Divisão de Lucro', rota: '/app/divisao-lucro', icone: 'lucro', termos: 'sócios partilha resultado' },
      { label: 'Sociedade', rota: '/app/sociedade', icone: 'socios', termos: 'sócio minha parte participação lucro' },
    ],
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    itens: [
      { label: 'Unidades', rota: '/app/unidades', icone: 'unidades', termos: 'estacionamentos locais' },
      { label: 'Sócios', rota: '/app/socios', icone: 'socios', termos: 'participação' },
      { label: 'Usuários', rota: '/app/usuarios', icone: 'usuarios', termos: 'acessos permissões senha' },
    ],
  },
];

/** Menu completo (lista plana) — usado na barra inferior e na paleta de comandos. */
export const NAV_ITEMS: NavItem[] = GRUPOS_MENU.flatMap((g) => g.itens);

/** Os quatro atalhos fixos da barra inferior; o quinto item é o "Mais". */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Início', rota: '/app/dashboard', icone: 'dashboard' },
  { label: 'Fichas', rota: '/app/fichas', icone: 'fichas' },
  { label: 'Lucro', rota: '/app/divisao-lucro', icone: 'lucro' },
  { label: 'Despesas', rota: '/app/despesas', icone: 'despesas' },
  { label: 'Sociedade', rota: '/app/sociedade', icone: 'socios', permissao: 'sociedade-atalho' },
];

export const PERFIL_ITEM: NavItem = { label: 'Meu perfil', rota: '/app/perfil', icone: 'perfil', termos: 'conta senha tutorial notificações' };

/** Itens que o nível do usuário pode ver (mesma regra do roleGuard). */
export function itensPermitidos(itens: NavItem[], nivel: NivelAcesso | null): NavItem[] {
  return itens.filter((item) => podeAcessar(nivel, item.permissao ?? item.rota.replace('/app/', '')));
}

/** Grupos com pelo menos um item visível para o nível. */
export function gruposPermitidos(nivel: NivelAcesso | null): GrupoMenu[] {
  return GRUPOS_MENU.map((g) => ({ ...g, itens: itensPermitidos(g.itens, nivel) })).filter((g) => g.itens.length);
}

/** Grupo de uma rota (para o "sobretítulo" das telas e a migalha da paleta). */
export function grupoDaRota(rota: string): GrupoMenu | undefined {
  return GRUPOS_MENU.find((g) => g.itens.some((i) => rota === i.rota || rota.startsWith(i.rota + '/')));
}

/** Cor determinística do avatar a partir do nome (tons da identidade, com contraste para texto branco). */
const CORES_AVATAR = ['#186a9d', '#2f6f6a', '#6b5bb5', '#a1523a', '#2c5282', '#7a4f9a', '#23845d', '#8a5a14'];

export function corDoAvatar(nome: string): string {
  const soma = [...nome].reduce((total, char) => total + char.charCodeAt(0), 0);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}
