import { create } from 'zustand';
import { Manobrista } from '../modelos';
import { api } from '../servicos/api';
import type { TipoPix } from '../servicos/pagamentos-manobristas';

const URL = '/manobristas';

export const useManobristas = create<{ manobristas: Manobrista[] }>(() => ({ manobristas: [] }));

export const nomeManobrista = (manobristas: Manobrista[], id: number) => manobristas.find((m) => m.id === id)?.nome ?? '—';

export const manobristasServico = {
  async carregar() {
    useManobristas.setState({ manobristas: await api.get<Manobrista[]>(URL) });
  },
  limpar() {
    useManobristas.setState({ manobristas: [] });
  },
  nome: (id: number) => nomeManobrista(useManobristas.getState().manobristas, id),
  async salvarManobrista(manobrista: Omit<Manobrista, 'id'> & { id?: number; pix?: { tipo: TipoPix; chave: string } }) {
    const salvo = manobrista.id
      ? await api.put<Manobrista>(`${URL}/${manobrista.id}`, manobrista)
      : await api.post<Manobrista>(URL, manobrista);
    useManobristas.setState(({ manobristas }) => ({
      manobristas: manobrista.id ? manobristas.map((m) => (m.id === salvo.id ? salvo : m)) : [...manobristas, salvo],
    }));
    return salvo;
  },
  async desativar(id: number) {
    await api.delete(`${URL}/${id}`);
    useManobristas.setState(({ manobristas }) => ({
      manobristas: manobristas.map((m) => (m.id === id ? { ...m, ativo: false } : m)),
    }));
  },
};
