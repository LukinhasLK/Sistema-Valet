import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';
import { aguardarDesligamentoPush, navegadorPushCompativel, salvarVinculoPush, vinculoPush } from './push-dispositivo';

const URL = `${API_URL}/notificacoes/push`;
export interface ConfiguracaoPush { chavePublica: string | null; inscrito: boolean; envioAtivo: boolean; pronto: boolean }
type ConfiguracaoServidor = Omit<ConfiguracaoPush, 'pronto'>;
export interface ResultadoTestePush { estado: 'ACEITA' | 'EXPIRADA' | 'FALHOU' | 'FALHA_REDE'; codigo: number | null }
export interface DiagnosticoPush { estado: string; tentativas: number; codigo: string | null; atualizadoEm: string }

@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private preparado: { usuario: number; chave: string; registro: ServiceWorkerRegistration } | null = null;

  async configuracao(): Promise<ConfiguracaoPush> {
    this.preparado = null;
    await aguardarDesligamentoPush();
    const usuario = this.auth.usuario()?.id;
    const atual = vinculoPush();
    const dispositivo = atual?.usuario === usuario ? atual?.dispositivo : undefined;
    const config = await firstValueFrom(this.http.get<ConfiguracaoServidor>(URL,
      dispositivo ? { params: { dispositivo } } : {}));
    const indisponivel = { ...config, inscrito: false, pronto: false };
    if (!usuario || !config.chavePublica || !navegadorPushCompativel()
      || Notification.permission === 'denied') return indisponivel;
    const registro = await navigator.serviceWorker.getRegistration('/');
    if (!registro?.active) return indisponivel;
    const inscricao = await registro.pushManager.getSubscription();
    if (this.auth.usuario()?.id !== usuario) return indisponivel;
    const chave = inscricao?.options.applicationServerKey;
    if (config.inscrito && chave && mesmaChave(decodificarChave(config.chavePublica), chave)) {
      return { ...config, pronto: true };
    }

    // Preparar a renovação antes do clique mantém subscribe dentro do gesto do usuário.
    if (inscricao) await inscricao.unsubscribe();
    if (this.auth.usuario()?.id !== usuario) return indisponivel;
    this.preparado = { usuario, chave: config.chavePublica, registro };
    return { ...config, inscrito: false, pronto: true };
  }

  async ativar(chavePublica: string): Promise<boolean> {
    const preparado = this.preparado;
    if (!preparado || preparado.usuario !== this.auth.usuario()?.id || preparado.chave !== chavePublica) {
      throw new Error('Atualize o estado do push e tente novamente.');
    }
    const { usuario, registro } = preparado;
    const atual = vinculoPush();
    const applicationServerKey = decodificarChave(chavePublica);
    let inscricao: PushSubscription;
    try {
      inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'NotAllowedError') return false;
      throw erro;
    }
    const dispositivo = atual?.usuario === usuario ? atual.dispositivo : crypto.randomUUID();
    if (this.auth.usuario()?.id !== usuario) {
      await inscricao.unsubscribe();
      return false;
    }
    try {
      await firstValueFrom(this.http.put<void>(`${URL}/${dispositivo}`, { endpoint: inscricao.endpoint, chavePublica }));
    } catch (erro) {
      await inscricao.unsubscribe().catch(() => false);
      throw erro;
    }
    salvarVinculoPush({ dispositivo, usuario });
    return true;
  }

  async testar(): Promise<ResultadoTestePush> {
    const atual = vinculoPush();
    if (!atual || atual.usuario !== this.auth.usuario()?.id) throw new Error('Ative o push neste dispositivo.');
    return firstValueFrom(this.http.post<ResultadoTestePush>(`${URL}/${atual.dispositivo}/teste`, {}));
  }

  async desativar(): Promise<void> {
    const atual = vinculoPush();
    if (atual?.usuario !== this.auth.usuario()?.id) return;
    const registro = navegadorPushCompativel() ? await navigator.serviceWorker.getRegistration('/') : undefined;
    const inscricao = await registro?.pushManager.getSubscription();
    await inscricao?.unsubscribe();
    if (atual) await firstValueFrom(this.http.delete<void>(`${URL}/${atual.dispositivo}`));
    salvarVinculoPush(null);
  }

  diagnostico() { return this.http.get<DiagnosticoPush[]>(`${URL}/diagnostico`); }
}

export function decodificarChave(chave: string): Uint8Array<ArrayBuffer> {
  const base = chave.replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='));
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

function mesmaChave(a: Uint8Array, b: ArrayBuffer): boolean {
  const outro = new Uint8Array(b);
  return a.length === outro.length && a.every((byte, i) => byte === outro[i]);
}
