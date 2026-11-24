import { create } from 'zustand';
import { Socio, Unidade } from '../modelos';
import { api } from '../servicos/api';

const URL = '/socios';

export interface RevisaoRateio {
  id: number;
  vigenteDesde: string;
  autor: string;
  criadoEm: string;
}

export interface CotaRateio {
  socioId: number;
  percentual: number;
}

export interface TotalUnidade {
  unidadeId: number;
  unidade: string;
  total: number;
  /** Fecha em 100% — pronto para dividir lucro. */
  valido: boolean;
  /** Ainda sem nenhum sócio: pendente, não é erro. */
  vazia: boolean;
}

export const useSocios = create<{ socios: Socio[] }>(() => ({ socios: [] }));

/** Soma dos percentuais por unidade — precisa fechar em 100%. */
export function totaisPorUnidade(socios: Socio[], unidades: Unidade[]): TotalUnidade[] {
  return unidades.map(({ id, nome }) => {
    const centavos = socios.reduce(
      (soma, socio) => soma + Math.round((socio.percentuais.find((p) => p.unidadeId === id)?.percentual ?? 0) * 100),
      0,
    );
    return { unidadeId: id, unidade: nome, total: centavos / 100, valido: centavos === 10000, vazia: centavos === 0 };
  });
}

export const percentualDoSocio = (socio: Socio, unidadeId: number) =>
  socio.percentuais.find((p) => p.unidadeId === unidadeId)?.percentual ?? null;

export const sociosDaUnidade = (socios: Socio[], unidadeId: number) =>
  socios.filter((s) => s.percentuais.some((p) => p.unidadeId === unidadeId && p.percentual > 0));

export const sociosServico = {
  async carregar() {
    useSocios.setState({ socios: await api.get<Socio[]>(URL) });
  },
  limpar() {
    useSocios.setState({ socios: [] });
  },
  async salvarSocio(socio: { nome: string; id?: number }) {
    const corpo = { nome: socio.nome };
    if (socio.id) await api.put(`${URL}/${socio.id}`, corpo);
    else await api.post(URL, corpo);
    await sociosServico.carregar();
  },
  listarCotas: (unidadeId: number, data: string) => api.get<CotaRateio[]>(`${URL}/rateio/${unidadeId}`, { data }),
  historicoRateio: (unidadeId: number) => api.get<RevisaoRateio[]>(`${URL}/rateio/${unidadeId}/historico`),
  async configurarRateio(unidadeId: number, vigenteDesde: string, partes: CotaRateio[]) {
    await api.post(`${URL}/rateio/${unidadeId}`, { vigenteDesde, partes });
    await sociosServico.carregar();
  },
  async excluir(id: number) {
    await api.delete(`${URL}/${id}`);
    useSocios.setState(({ socios }) => ({ socios: socios.filter((s) => s.id !== id) }));
  },
};
