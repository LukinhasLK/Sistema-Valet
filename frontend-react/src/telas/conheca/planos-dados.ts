/**
 * PLANOS DO PARK FLASH — conteúdo comercial editável.
 *
 * ⚠️ Proposta inicial a confirmar com o proprietário do produto:
 * - `preco: null` mostra "Sob consulta". Para publicar um preço, preencha (ex.: 'R$ 199') e o `periodo`.
 * - Os recursos listados existem no sistema hoje; não acrescente itens que ainda não foram implementados.
 * - `CONTATO_COMERCIAL`: preencha WhatsApp (só números, com DDI e DDD) e/ou e-mail para ativar o botão.
 */
export interface Plano {
  id: string;
  nome: string;
  resumo: string;
  preco: string | null;
  periodo?: string;
  destaque?: boolean;
  recursos: string[];
}

export const CONTATO_COMERCIAL: { whatsapp: string | null; email: string | null } = {
  whatsapp: null,
  email: null,
};

export const PLANOS: Plano[] = [
  {
    id: 'essencial',
    nome: 'Essencial',
    resumo: 'Para um estacionamento que quer sair da planilha.',
    preco: null,
    recursos: [
      '1 unidade',
      'Fichas de caixa por turno com conferência e fechamento',
      'Controle de veículos e carros por mês e por dia',
      'Despesas e relatório mensal em PDF e Excel',
      'Uso no computador e no celular',
    ],
  },
  {
    id: 'operacao',
    nome: 'Operação',
    resumo: 'Para quem tem equipe e precisa pagar e acompanhar o dia a dia.',
    preco: null,
    destaque: true,
    recursos: [
      'Tudo do Essencial',
      'Várias unidades com acesso por unidade',
      'Pagamentos de manobristas com chave Pix',
      'Notificações no celular para a gestão',
      'Eventos e escalas com calendário',
      'Perfis de proprietário, gerente e operador',
    ],
  },
  {
    id: 'rede',
    nome: 'Rede',
    resumo: 'Para operações com sócios e várias unidades.',
    preco: null,
    recursos: [
      'Tudo do Operação',
      'Divisão de lucro entre sócios por unidade',
      'Histórico de alterações administrativas',
      'Relatórios consolidados de todas as unidades',
      'Acompanhamento na implantação',
    ],
  },
];

/** Tabela de comparação: o que cada plano inclui (true/false ou texto). */
export const COMPARACAO: { recurso: string; planos: Record<string, boolean | string> }[] = [
  { recurso: 'Unidades', planos: { essencial: '1', operacao: 'Várias', rede: 'Várias' } },
  { recurso: 'Fichas de caixa e fechamento', planos: { essencial: true, operacao: true, rede: true } },
  { recurso: 'Controle de veículos (carros por dia e por mês)', planos: { essencial: true, operacao: true, rede: true } },
  { recurso: 'Despesas e relatórios em PDF e Excel', planos: { essencial: true, operacao: true, rede: true } },
  { recurso: 'Rascunho automático da ficha no aparelho', planos: { essencial: true, operacao: true, rede: true } },
  { recurso: 'Pagamentos de manobristas com chave Pix', planos: { essencial: false, operacao: true, rede: true } },
  { recurso: 'Notificações no celular', planos: { essencial: false, operacao: true, rede: true } },
  { recurso: 'Eventos e escalas com calendário', planos: { essencial: false, operacao: true, rede: true } },
  { recurso: 'Divisão de lucro entre sócios', planos: { essencial: false, operacao: false, rede: true } },
  { recurso: 'Histórico de alterações administrativas', planos: { essencial: false, operacao: false, rede: true } },
];
