import { create } from 'zustand';
import { NivelAcesso, Usuario } from '../modelos';
import { api, configurarApi, ErroHttp } from '../servicos/api';
import { podeAcessar } from '../servicos/permissoes';
import { desligarPushDaSessao, liberarAparelhoDeOutroUsuario } from '../servicos/push-dispositivo';
import { carregar, remover, salvar } from '../servicos/storage';
import { onboardingServico } from '../onboarding/estado';
import { descartarRascunhosDoUsuario } from '../servicos/rascunho-ficha';
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
      liberarAparelhoDeOutroUsuario(resposta.usuario.id);
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
      // Token vencido ou inválido: encerra a sessão, mas o aparelho continua autorizado para push.
      encerrarSessao(false);
    }
  },

  trocarSenha: (senhaAtual: string, novaSenha: string) => api.put<void>('/auth/senha', { senhaAtual, novaSenha }),

  /**
   * Saída pedida pelo usuário: além de encerrar a sessão, revoga a inscrição de push
   * deste aparelho (o servidor deixa de enviar notificações desse usuário para cá).
   */
  logout(): void {
    encerrarSessao(true);
  },
};

/**
 * Encerra a sessão local. `revogarPush`:
 * - true (logout explícito): desliga as notificações deste aparelho para o usuário;
 * - false (sessão expirada): mantém a inscrição — o aparelho segue autorizado a receber
 *   avisos (sem conteúdo sensível) até o usuário sair da conta ou desativar no perfil.
 */
function encerrarSessao(revogarPush: boolean): void {
  const { usuario, token } = useAuth.getState();
  if (revogarPush) desligarPushDaSessao(usuario?.id, token);
  // Logout explícito apaga os rascunhos de ficha deste usuário (aparelho pode ser compartilhado).
  // Na sessão expirada eles ficam: é justamente o caso que o rascunho protege.
  if (revogarPush && usuario) descartarRascunhosDoUsuario(usuario.id);
  remover(CHAVE_TOKEN);
  useAuth.setState({ token: null, usuario: null });
  [unidadesServico, manobristasServico, sociosServico, fichasServico, despesasServico, usuariosServico].forEach((s) => s.limpar());
  onboardingServico.encerrarSessao();
}

// Toda chamada à API leva o token; um 401 com sessão aberta encerra a sessão (a rota protegida manda ao login).
configurarApi({
  token: () => useAuth.getState().token,
  sessaoExpirada: () => {
    if (useAuth.getState().usuario) encerrarSessao(false);
  },
});
