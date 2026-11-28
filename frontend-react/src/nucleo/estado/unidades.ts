import { create } from 'zustand';
import { Unidade } from '../modelos';
import { api } from '../servicos/api';

const URL = '/unidades';

export const useUnidades = create<{ unidades: Unidade[] }>(() => ({ unidades: [] }));

/** Nome para exibição; registros antigos de uma unidade removida aparecem como "—". */
export const nomeUnidade = (unidades: Unidade[], id: number) => unidades.find((u) => u.id === id)?.nome ?? '—';

export const unidadesServico = {
  async carregar() {
    useUnidades.setState({ unidades: await api.get<Unidade[]>(URL) });
  },
  limpar() {
    useUnidades.setState({ unidades: [] });
  },
  nome: (id: number) => nomeUnidade(useUnidades.getState().unidades, id),
  async salvarUnidade(unidade: Omit<Unidade, 'id'> & { id?: number }) {
    const salva = unidade.id ? await api.put<Unidade>(`${URL}/${unidade.id}`, unidade) : await api.post<Unidade>(URL, unidade);
    useUnidades.setState(({ unidades }) => ({
      unidades: unidade.id ? unidades.map((u) => (u.id === salva.id ? salva : u)) : [...unidades, salva],
    }));
    return salva;
  },
  /** A unidade desativada continua disponível para filtros e referências históricas. */
  async desativar(id: number) {
    await api.delete(`${URL}/${id}`);
    useUnidades.setState(({ unidades }) => ({ unidades: unidades.map((u) => (u.id === id ? { ...u, ativa: false } : u)) }));
  },  /** Exclusão definitiva: o servidor recusa (409) se a unidade tiver qualquer registro ligado. */
  async excluir(id: number) {
    await api.delete(`${URL}/${id}/definitivo`);
    useUnidades.setState(({ unidades }) => ({ unidades: unidades.filter((u) => u.id !== id) }));
  },
};
