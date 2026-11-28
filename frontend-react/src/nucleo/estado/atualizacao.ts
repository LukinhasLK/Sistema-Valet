import { useEffect } from 'react';
import { despesasServico } from './despesas';
import { fichasServico } from './fichas';
import { useAuth } from './auth';
import { pendenciasServico } from '../servicos/pendencias';
import { podeAcessar } from '../servicos/permissoes';

const INTERVALO_MS = 2 * 60_000;
const MINIMO_ENTRE_ATUALIZACOES_MS = 20_000;
let ultima = Date.now();
let emAndamento: Promise<void> | null = null;

/** Recarrega fichas (e despesas, se o nível vê) e as pendências do Perdidinho ajudante sem atrapalhar: ignora falhas e chamadas muito próximas. */
export function atualizarDados(forcar = false): Promise<void> {
  if (emAndamento) return emAndamento;
  if (!forcar && Date.now() - ultima < MINIMO_ENTRE_ATUALIZACOES_MS) return Promise.resolve();
  const nivel = useAuth.getState().usuario?.nivel ?? null;
  if (!nivel) return Promise.resolve();
  ultima = Date.now();
  emAndamento = Promise.all([
    fichasServico.carregar(),
    podeAcessar(nivel, 'despesas') ? despesasServico.carregar() : Promise.resolve(),
    pendenciasServico.atualizar(forcar),
  ]).then(() => undefined, () => undefined).finally(() => { emAndamento = null; });
  return emAndamento;
}

/**
 * Mantém os dados atualizados sem recarregar a página: ao voltar para a aba/app,
 * a cada 2 minutos com a tela visível e quando chega uma notificação push.
 * Assim a ficha lançada pelo gerente aparece para o proprietário sozinha.
 */
export function useAtualizacaoAutomatica(): void {
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') void atualizarDados(); };
    const doWorker = (e: MessageEvent) => { if (e.data?.tipo === 'PARKFLASH_NOTIFICACAO') void atualizarDados(true); };
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void atualizarDados(); }, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    navigator.serviceWorker?.addEventListener('message', doWorker);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
      navigator.serviceWorker?.removeEventListener('message', doWorker);
    };
  }, []);
}
