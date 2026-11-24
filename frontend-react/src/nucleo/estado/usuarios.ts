import { create } from 'zustand';
import { Usuario } from '../modelos';
import { api } from '../servicos/api';

const URL = '/usuarios';

/** Cadastro de usuários (somente Proprietário). A API nunca devolve senha nem hash. */
export const useUsuarios = create<{ usuarios: Usuario[] }>(() => ({ usuarios: [] }));

export const usuariosServico = {
  async carregar() {
    useUsuarios.setState({ usuarios: await api.get<Usuario[]>(URL, { incluirInativos: true }) });
  },
  limpar() {
    useUsuarios.setState({ usuarios: [] });
  },
  /** Na edição, senha vazia mantém a senha atual. */
  async salvarUsuario(usuario: Omit<Usuario, 'id'> & { id?: number }) {
    const { id, ...dados } = usuario;
    const corpo = { ...dados, senha: dados.senha || null };
    const salvo = id ? await api.put<Usuario>(`${URL}/${id}`, corpo) : await api.post<Usuario>(URL, corpo);
    useUsuarios.setState(({ usuarios }) => ({
      usuarios: id ? usuarios.map((u) => (u.id === salvo.id ? salvo : u)) : [...usuarios, salvo],
    }));
    return salvo;
  },
  emailEmUso(email: string, ignorarId?: number) {
    const busca = email.trim().toLowerCase();
    return useUsuarios.getState().usuarios.some((u) => u.id !== ignorarId && u.email.toLowerCase() === busca);
  },
  async excluir(id: number) {
    await api.delete(`${URL}/${id}`);
    useUsuarios.setState(({ usuarios }) => ({ usuarios: usuarios.map((u) => (u.id === id ? { ...u, ativo: false } : u)) }));
  },
};
