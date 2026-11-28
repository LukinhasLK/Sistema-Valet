import { NivelAcesso } from '../modelos';
import { podeAcessar } from '../servicos/permissoes';
import type { HumorMascote } from './mascote';

/**
 * Um passo do tour guiado.
 * - `alvo`: valor do atributo `data-tour` do elemento destacado (sem alvo = cartão centralizado).
 * - `rota`: tela onde o passo acontece (o tour navega até ela).
 * - `exige`: rota de permissão necessária para o passo aparecer (mesma regra do menu).
 */
export interface PassoTour {
  id: string;
  titulo: string;
  texto: string;
  alvo?: string;
  rota?: string;
  exige?: string;
  lado?: 'top' | 'bottom' | 'left' | 'right';
  humor?: HumorMascote;
}

/** Suba a versão quando o roteiro mudar de forma relevante: quem já concluiu é convidado de novo. */
export const VERSAO_ROTEIRO = 1;

const PASSOS: PassoTour[] = [
  {
    id: 'boas-vindas',
    titulo: 'Bem-vindo ao Park Flash',
    texto: 'Em um minuto você conhece o essencial: onde lançar o caixa, como conferir e onde encontrar cada coisa. Use as setas do teclado ou os botões abaixo.',
    humor: 'acenando',
  },
  {
    id: 'menu',
    titulo: 'Tudo organizado por contexto',
    texto: 'O menu reúne as telas em Operação, Equipe, Financeiro e Cadastros. Você vê apenas o que o seu perfil pode acessar.',
    alvo: 'menu',
    lado: 'right',
  },
  {
    id: 'paleta',
    titulo: 'Vá para qualquer lugar em segundos',
    texto: 'Pressione ⌘K (Mac) ou Ctrl+K para buscar telas, ações e fichas pela data ou pela unidade.',
    alvo: 'paleta',
    lado: 'right',
  },
  {
    id: 'dashboard',
    titulo: 'O mês num relance',
    texto: 'Os indicadores mostram fichas, carros, faturamento e líquido do período selecionado.',
    alvo: 'kpis-dashboard',
    rota: '/app/dashboard',
    exige: 'dashboard',
    lado: 'bottom',
  },
  {
    id: 'nova-ficha',
    titulo: 'Lance o caixa do turno',
    texto: 'Cada ficha registra a numeração dos tickets, os cancelados, os recebimentos e a equipe do turno.',
    alvo: 'nova-ficha',
    rota: '/app/fichas',
    exige: 'fichas/nova',
    lado: 'bottom',
  },
  {
    id: 'filtros-fichas',
    titulo: 'Filtre sem perder o lugar',
    texto: 'Mês, unidade, situação e manobrista ficam guardados no endereço da página: copie o link e quem abrir verá a mesma lista.',
    alvo: 'filtros-fichas',
    rota: '/app/fichas',
    exige: 'fichas',
    lado: 'bottom',
  },
  {
    id: 'lista-fichas',
    titulo: 'Conferência com prioridade',
    texto: 'As fichas são agrupadas por situação: o que está pronto para conferência aparece primeiro. Clique numa ficha para ver o detalhe; J e K navegam entre elas.',
    alvo: 'lista-fichas',
    rota: '/app/fichas',
    exige: 'fichas',
    lado: 'top',
  },
  {
    id: 'pagamentos',
    titulo: 'Pague a equipe com a chave em mãos',
    texto: 'As diárias pendentes aparecem com a chave Pix do manobrista. Você paga pelo seu banco e confirma aqui; a situação e o histórico são atualizados.',
    alvo: 'pagamentos',
    rota: '/app/pagamentos-manobristas',
    exige: 'pagamentos-manobristas',
    lado: 'bottom',
  },
  {
    id: 'perfil',
    titulo: 'Sua conta',
    texto: 'Em Meu perfil você troca a senha, ativa as notificações neste aparelho e pode rever este tour quando quiser.',
    alvo: 'perfil',
    lado: 'right',
    humor: 'comemorando',
  },
];

/** Passos que o nível pode ver (o tour nunca leva a uma tela sem permissão). */
export function roteiroDo(nivel: NivelAcesso | null): PassoTour[] {
  return PASSOS.filter((p) => !p.exige || podeAcessar(nivel, p.exige));
}

/** Dicas contextuais: aparecem uma vez por tela, sem bloquear o uso. */
export const DICAS_CONTEXTUAIS: Record<string, { titulo: string; texto: string }> = {
  fichas: {
    titulo: 'Atalhos desta tela',
    texto: 'Digite / para buscar, J e K para percorrer as fichas e Enter para abrir o detalhe.',
  },
};
