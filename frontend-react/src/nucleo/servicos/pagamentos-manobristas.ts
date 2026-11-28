import { api, Parametros } from './api';

export type Situacao = 'PENDENTE' | 'PAGO' | 'ESTORNADO';
export type Forma = 'PIX' | 'DINHEIRO' | 'TRANSFERENCIA' | 'OUTRA';
export type TipoPix = 'CPF' | 'CNPJ' | 'TELEFONE' | 'EMAIL' | 'ALEATORIA';
export type Aba = 'diarias' | 'conferencia' | 'historico';

export interface FiltroPagamentos {
  inicio: string;
  fim: string;
  manobristaId: number;
  unidadeId: number;
  busca: string;
  situacao: Situacao | '';
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface Valores {
  aPagar: number;
  pago: number;
}
export interface Pendencia {
  manobristaId: number;
  manobrista: string;
  unidadeId: number;
  unidade: string;
  diarias: number;
  saldo: number;
}

export interface Resumo extends Valores {
  pendencias: Pendencia[];
  manobristasPendentes: number;
  pagamentos: number;
  unidades: (Valores & { unidade: string })[];
  meses: (Valores & { ano: number; mes: number })[];
}

export interface Candidato {
  fichaId: number;
  manobristaId: number;
  manobrista: string;
  unidade: string;
  unidadeId: number;
  data: string;
  turno: 'DIA' | 'NOITE';
  custo: number;
}

export interface Diaria extends Pick<Candidato, 'fichaId' | 'manobristaId' | 'manobrista' | 'unidade' | 'data' | 'custo'> {
  id: number;
  devido: number;
  pago: number;
  saldo: number;
  situacao: Situacao;
  pagamentoId: number | null;
  dataPagamento: string | null;
  revisao: number;
}

export interface Pagamento {
  id: number;
  manobrista: string;
  manobristaId: number;
  data: string;
  valor: number;
  forma: Forma;
  confirmador: string;
  confirmadoEm: string;
  estornadoEm: string | null;
  motivoEstorno: string | null;
  estornador: string | null;
  temComprovante: boolean;
  itens: { diariaId: number; fichaId: number; unidade: string; data: string; valor: number }[];
}

export interface Pix {
  tipo: TipoPix;
  chaveMascarada: string;
}

export interface Confirmacao {
  operacao: string;
  manobristaId: number;
  diarias: Pick<Diaria, 'id' | 'revisao'>[];
  data: string;
  forma: Forma;
  efetuado: true;
  valor: string;
}

const URL = '/pagamentos-manobristas';

/** Só envia filtros preenchidos (o Angular omitia vazios e zeros). */
function params(filtro: FiltroPagamentos): Parametros {
  const saida: Parametros = {};
  for (const [chave, valor] of Object.entries(filtro)) if (valor) saida[chave] = valor;
  return saida;
}

export const pagamentosServico = {
  resumo: (filtro: FiltroPagamentos) => api.get<Resumo>(`${URL}/resumo`, params(filtro)),
  listar: <T>(aba: Aba, filtro: FiltroPagamentos, pagina: number) =>
    api.get<Pagina<T>>(`${URL}/${aba}`, { ...params(filtro), pagina }),
  reconhecer: (candidato: Candidato, valor: string) =>
    api.post<{ id: number }>(`${URL}/conferencia/${candidato.fichaId}`, {
      manobristaId: candidato.manobristaId, custoConferido: candidato.custo, valor,
      dataConferida: candidato.data, turnoConferido: candidato.turno, unidadeConferida: candidato.unidadeId,
    }),
  confirmar(dados: Confirmacao, anexo: File | null) {
    const corpo = new FormData();
    corpo.set('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    if (anexo) corpo.set('comprovante', anexo);
    return api.post<Pagamento>(URL, corpo);
  },
  detalhar: (id: number) => api.get<Pagamento>(`${URL}/historico/${id}`),
  estornar: (id: number, motivo: string) => api.post<Pagamento>(`${URL}/historico/${id}/estorno`, { motivo }),
  /** Anula uma diária lançada errada que nunca foi paga (só a gestão). */
  anular: (diariaId: number, motivo: string) => api.post<void>(`${URL}/diarias/${diariaId}/anulacao`, { motivo }),
  comprovante: (id: number) => api.arquivo(`${URL}/historico/${id}/comprovante`),
  consultarPix: (id: number) => api.get<Pix>(`${URL}/pix/${id}`),
  salvarPix: (id: number, tipo: TipoPix, chave: string) => api.put<Pix>(`${URL}/pix/${id}`, { tipo, chave }),
  revelarPix: (id: number) => api.post<{ chave: string }>(`${URL}/pix/${id}/revelar`, {}),
};
