import { useAuth } from '../estado/auth';
import { api } from './api';
import { aguardarDesligamentoPush, navegadorPushCompativel, salvarVinculoPush, vinculoPush } from './push-dispositivo';

const URL = '/notificacoes/push';
const usuarioAtual = () => useAuth.getState().usuario?.id;
export interface ConfiguracaoPush { chavePublica: string | null; inscrito: boolean; envioAtivo: boolean; pronto: boolean }
type ConfiguracaoServidor = Omit<ConfiguracaoPush, 'pronto'>;
export interface ResultadoTestePush { estado: 'ACEITA' | 'EXPIRADA' | 'FALHOU' | 'FALHA_REDE'; codigo: number | null }
export interface DiagnosticoPush { estado: string; tentativas: number; codigo: string | null; atualizadoEm: string }

let preparado: { usuario: number; chave: string; registro: ServiceWorkerRegistration } | null = null;

export const webPushServico = {
  async configuracao(): Promise<ConfiguracaoPush> {
    preparado = null;
    await aguardarDesligamentoPush();
    const usuario = usuarioAtual();
    const atual = vinculoPush();
    const dispositivo = atual?.usuario === usuario ? atual?.dispositivo : undefined;
    const config = await api.get<ConfiguracaoServidor>(URL, { dispositivo });
    const indisponivel = { ...config, inscrito: false, pronto: false };
    if (!usuario || !config.chavePublica || !navegadorPushCompativel() || Notification.permission === 'denied') return indisponivel;
    const registro = await navigator.serviceWorker.getRegistration('/');
    if (!registro?.active) return indisponivel;
    const inscricao = await registro.pushManager.getSubscription();
    if (usuarioAtual() !== usuario) return indisponivel;
    const chave = inscricao?.options.applicationServerKey;
    if (config.inscrito && chave && mesmaChave(decodificarChave(config.chavePublica), chave)) return { ...config, pronto: true };

    // Preparar a renovação antes do clique mantém subscribe dentro do gesto do usuário.
    if (inscricao) await inscricao.unsubscribe();
    if (usuarioAtual() !== usuario) return indisponivel;
    preparado = { usuario, chave: config.chavePublica, registro };
    return { ...config, inscrito: false, pronto: true };
  },

  async ativar(chavePublica: string): Promise<boolean> {
    const atualPreparado = preparado;
    if (!atualPreparado || atualPreparado.usuario !== usuarioAtual() || atualPreparado.chave !== chavePublica) {
      throw new Error('Atualize o estado do push e tente novamente.');
    }
    const { usuario, registro } = atualPreparado;
    const atual = vinculoPush();
    let inscricao: PushSubscription;
    try {
      inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodificarChave(chavePublica) });
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'NotAllowedError') return false;
      throw erro;
    }
    const dispositivo = atual?.usuario === usuario ? atual.dispositivo : crypto.randomUUID();
    if (usuarioAtual() !== usuario) {
      await inscricao.unsubscribe();
      return false;
    }
    try {
      await api.put<void>(`${URL}/${dispositivo}`, { endpoint: inscricao.endpoint, chavePublica });
    } catch (erro) {
      await inscricao.unsubscribe().catch(() => false);
      throw erro;
    }
    salvarVinculoPush({ dispositivo, usuario });
    return true;
  },

  async testar(): Promise<ResultadoTestePush> {
    const atual = vinculoPush();
    if (!atual || atual.usuario !== usuarioAtual()) throw new Error('Ative o push neste dispositivo.');
    return api.post<ResultadoTestePush>(`${URL}/${atual.dispositivo}/teste`, {});
  },

  async desativar(): Promise<void> {
    const atual = vinculoPush();
    if (atual?.usuario !== usuarioAtual()) return;
    const registro = navegadorPushCompativel() ? await navigator.serviceWorker.getRegistration('/') : undefined;
    const inscricao = await registro?.pushManager.getSubscription();
    await inscricao?.unsubscribe();
    if (atual) await api.delete(`${URL}/${atual.dispositivo}`);
    salvarVinculoPush(null);
  },

  diagnostico: () => api.get<DiagnosticoPush[]>(`${URL}/diagnostico`),
};
export function decodificarChave(chave: string): Uint8Array<ArrayBuffer> {
  const base = chave.replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='));
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

function mesmaChave(a: Uint8Array, b: ArrayBuffer): boolean {
  const outro = new Uint8Array(b);
  return a.length === outro.length && a.every((byte, i) => byte === outro[i]);
}
