import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { carregar, salvar } from '../servicos/storage';

const CHAVE_MENU = 'parkflash.menuRecolhido';

interface EstadoInterface {
  /** Preferência do usuário; `null` = automático (recolhido em telas médias, como tablets). */
  menuRecolhido: boolean | null;
  paletaAberta: boolean;
}

export const useInterface = create<EstadoInterface>(() => ({
  menuRecolhido: carregar<boolean | null>(CHAVE_MENU, null),
  paletaAberta: false,
}));

export const interfaceServico = {
  alternarMenu(recolhidoAgora: boolean) {
    const novo = !recolhidoAgora;
    useInterface.setState({ menuRecolhido: novo });
    salvar(CHAVE_MENU, novo);
  },
  abrirPaleta: () => useInterface.setState({ paletaAberta: true }),
  fecharPaleta: () => useInterface.setState({ paletaAberta: false }),
  alternarPaleta: () => useInterface.setState((s) => ({ paletaAberta: !s.paletaAberta })),
};

const TELA_MEDIA = '(max-width: 1179px)';

function useTelaMedia(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(TELA_MEDIA);
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => window.matchMedia(TELA_MEDIA).matches,
    () => false,
  );
}

/** O menu está recolhido agora? (preferência salva ou, sem preferência, o tamanho da tela) */
export function useMenuRecolhido(): boolean {
  const preferencia = useInterface((s) => s.menuRecolhido);
  const media = useTelaMedia();
  return preferencia ?? media;
}

/** Rótulo do atalho de teclado conforme o sistema (⌘ no Mac, Ctrl nos demais). */
export const teclaComando = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
