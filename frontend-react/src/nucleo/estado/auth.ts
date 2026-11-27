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
export const useAuth = create<{ token: string | null; usuario: Usuario | null; semConexao: boolean }>(() => ({
  token: carregar<string | null>(CHAVE_TOKEN, null),
  usuario: null,
  /** Há sessão salva, mas o servidor não respondeu ao abrir o app (sem sinal, deploy): o login é mantido. */
  semConexao: false,
}));

const esperar = (ms: number) => new Promise((fim) => setTimeout(fim, ms));
/** Falha passageira: sem rede (status 0) ou servidor fora do ar (5xx). Não é motivo para pedir a senha de novo. */
const passageira = (erro: unknown) => erro instanceof ErroHttp && (erro.status === 0 || erro.status >= 500);

export const useUsuario = () => useAuth((s) => s.usuario);
export const useNivel = () => useAuth((s) => s.usuario?.nivel ?? null);
export const inicialDe = (usuario: Usuario | null) => usuario?.nome.charAt(0).toUpperCase() ?? '?';

/** Carrega só o que o nível pode ver — o servidor recusaria o resto com 403. */
async function carregarDados(nivel: NivelAcesso): Promise<void> {
  // O sócio não vê a operação: a tela dele busca o que precisa sozinha.
  if (!podeAcessar(nivel, 'fichas')) return;
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
    useAuth.setState({ semConexao: false });
    let usuario: Usuario | null = null;
    // Algumas tentativas antes de desistir: o valet abre o app no subsolo, ou o servidor está reiniciando.
    for (const espera of [0, 1500, 3000]) {
      if (espera) await esperar(espera);
      try {
        usuario = await api.get<Usuario>('/auth/me');
        break;
      } catch (erro) {
        if (!passageira(erro)) {
          // 401/403: token vencido ou inválido. Encerra a sessão, mas o aparelho continua autorizado para push.
          encerrarSessao(false);
          return;
        }
      }
    }
    if (!usuario) {
      // Continua sem conexão: mantém o token e mostra a tela "sem conexão" em vez de pedir a senha.
      useAuth.setState({ semConexao: true });
      return;
    }
    useAuth.setState({ usuario });
    await carregarDados(usuario.nivel).catch(() => undefined); // as telas recarregam quando a conexão voltar
  },

  trocarSenha: (senhaAtual: string, novaSenha: string) => api.put<void>('/auth/senha', { senhaAtual, novaSenha }),

  /** Encerra o login em todos os aparelhos (e o link de agenda) e sai deste também. */
  async sairDeTodos(): Promise<void> {
    await api.post<void>('/auth/sair-de-todos');
    authServico.logout();
  },

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
  useAuth.setState({ token: null, usuario: null, semConexao: false });
  [unidadesServico, manobristasServico, sociosServico, fichasServico, despesasServico, usuariosServico].forEach((s) => s.limpar());
  onboardingServico.encerrarSessao();
}

// Toda chamada à API leva o token; um 401 com sessão aberta encerra a sessão (a rota protegida manda ao login).
configurarApi({
  token: () => useAuth.getState().token,
  sessaoExpirada: (tokenUsado) => {
    const { usuario, token } = useAuth.getState();
    if (usuario && tokenUsado === token) encerrarSessao(false);
  },
});
