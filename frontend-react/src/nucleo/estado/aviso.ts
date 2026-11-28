import { create } from 'zustand';
import { mensagemDeErro } from '../servicos/api';

export interface Aviso {
  tipo: 'erro' | 'sucesso';
  texto: string;
}

/** Aviso flutuante (toast) para retorno das operações na API. */
export const useAviso = create<{ aviso: Aviso | null }>(() => ({ aviso: null }));

let timer: ReturnType<typeof setTimeout> | undefined;

function mostrar(aviso: Aviso): void {
  clearTimeout(timer);
  useAviso.setState({ aviso });
  timer = setTimeout(() => useAviso.setState({ aviso: null }), aviso.tipo === 'erro' ? 6000 : 3000);
}

export const avisos = {
  sucesso: (texto: string) => mostrar({ tipo: 'sucesso', texto }),
  erro: (erro: unknown, padrao?: string) => mostrar({ tipo: 'erro', texto: mensagemDeErro(erro, padrao) }),
  fechar: () => {
    clearTimeout(timer);
    useAviso.setState({ aviso: null });
  },
};
