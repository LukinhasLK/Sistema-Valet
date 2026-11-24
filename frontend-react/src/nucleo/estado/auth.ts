import { create } from 'zustand';
import { NivelAcesso, Usuario } from '../modelos';
import { api, configurarApi, ErroHttp } from '../servicos/api';
import { podeAcessar } from '../servicos/permissoes';
import { desligarPushDaSessao } from '../servicos/push-dispositivo';
import { carregar, remover, salvar } from '../servicos/storage';
import { despesasServico } from './despesas';
import { fichasServico } from './fichas';
import { manobristasServico } from './manobristas';
import { sociosServico } from './socios';
import { unidadesServico } from './unidades';
import { usuariosServico } from './usuarios';

const CHAVE_TOKEN = 'parkflash.token';

interface RespostaLogin {
  token: string;
  usuario: Usuario;
}

/**
 * Sessão via JWT emitido por POST /api/auth/login. O token só prova quem é o usuário:
 * as permissões valem no servidor, e o nível exibido aqui vem sempre da API.
 */
export const useAuth = create<{ token: string | null; usuario: Usuario | null }>(() => ({
  token: carregar<string | null>(CHAVE_TOKEN, null),
  usuario: null,
}));

export const useUsuario = () => useAuth((s) => s.usuario);
export const useNivel = () => useAuth((s) => s.usuario?.nivel ?? null);
export const inicialDe = (usuario: Usuario | null) => usuario?.nome.charAt(0).toUpperCase() ?? '?';

/** Carrega só o que o nível pode ver — o servidor recusaria o resto com 403. */
async function carregarDados(nivel: NivelAcesso): Promise<void> {
  await Promise.all([
    unidadesServico.carregar(),
    manobristasServico.carregar(),
    podeAcessar(nivel, 'socios') ? sociosServico.carregar() : Promise.resolve(),
    fichasServico.carregar(),
    podeAcessar(nivel, 'despesas') ? despesasServico.carregar() : Promise.resolve(),
    podeAcessar(nivel, 'usuarios') ? usuariosServico.carregar() : Promise.resolve(),
  ]);
}

export const authServico = {
  /** Retorna false para credenciais erradas; outros erros (servidor fora do ar) são lançados. */
  async login(identificador: string, senha: string): Promise<boolean> {
    if (!identificador.trim() || !senha) return false;
    try {
      const resposta = await api.post<RespostaLogin>('/auth/login', { identificador: identificador.trim(), senha });
      salvar(CHAVE_TOKEN, resposta.token);
      useAuth.setState({ token: resposta.token, usuario: resposta.usuario });
      await carregarDados(resposta.usuario.nivel);
      return true;
    } catch (erro) {
      authServico.logout();
      if (erro instanceof ErroHttp && erro.status === 401) return false;
      throw erro;
    }
  },

  /** Na abertura do app: se houver token salvo, confirma com o servidor e recarrega os dados. */
  async restaurarSessao(): Promise<void> {
    if (!useAuth.getState().token) return;
    try {
      const usuario = await api.get<Usuario>('/auth/me');
      useAuth.setState({ usuario });
      await carregarDados(usuario.nivel);
    } catch {
      authServico.logout();
    }
  },

  trocarSenha: (senhaAtual: string, novaSenha: string) => api.put<void>('/auth/senha', { senhaAtual, novaSenha }),

  logout(): void {
    const { usuario, token } = useAuth.getState();
    desligarPushDaSessao(usuario?.id, token);
    remover(CHAVE_TOKEN);
    useAuth.setState({ token: null, usuario: null });
    [unidadesServico, manobristasServico, sociosServico, fichasServico, despesasServico, usuariosServico].forEach((s) => s.limpar());
  },
};

// Toda chamada à API leva o token; um 401 com sessão aberta encerra a sessão (a rota protegida manda ao login).
configurarApi({
  token: () => useAuth.getState().token,
  sessaoExpirada: () => {
    if (useAuth.getState().usuario) authServico.logout();
  },
});
