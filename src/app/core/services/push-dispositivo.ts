const CHAVE = 'parkflash.v3.push';
interface VínculoPush {
  dispositivo: string;
  usuario: number;
}

let desligando: Promise<void> = Promise.resolve();

export function vinculoPush(): VínculoPush | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? JSON.parse(texto) as VínculoPush : null;
  } catch {
    return null;
  }
}

export function salvarVinculoPush(vinculo: VínculoPush | null): void {
  if (vinculo) localStorage.setItem(CHAVE, JSON.stringify(vinculo));
  else localStorage.removeItem(CHAVE);
}

export function aguardarDesligamentoPush(): Promise<void> {
  return desligando;
}

export function desligarPushDaSessao(usuario: number | undefined, token: string | null): void {
  const vinculo = vinculoPush();
  if (!vinculo || vinculo.usuario !== usuario) return;

  desligando = (async () => {
    const registro = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
    const inscricao = await registro?.pushManager?.getSubscription();
    await Promise.allSettled([
      inscricao?.unsubscribe(),
      token ? fetch(`/api/notificacoes/push/${vinculo.dispositivo}`, {
        method: 'DELETE', keepalive: true, headers: { Authorization: `Bearer ${token}` },
      }) : undefined,
    ]);
    if (vinculoPush()?.dispositivo === vinculo.dispositivo) salvarVinculoPush(null);
  })().catch(() => {
    // Se o navegador estiver fechando, a sessão seguinte confere e limpa o vínculo.
  });
}

export function navegadorPushCompativel(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
