import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface CampoFiltro<V> {
  /** Valor quando o parâmetro não está na URL. Valores iguais ao padrão saem da URL. */
  padrao: V;
  /** Converte o texto da URL; `undefined` = inválido (usa o padrão). */
  ler: (bruto: string) => V | undefined;
  escrever?: (valor: V) => string;
}

type Esquema = Record<string, CampoFiltro<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Valores<E extends Esquema> = { [K in keyof E]: E[K]['padrao'] };

/** Leitores prontos para os tipos de filtro mais comuns. */
export const lerFiltro = {
  inteiro: (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => (bruto: string) => {
    const n = Number(bruto);
    return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
  },
  idOuNulo: (bruto: string) => {
    const n = Number(bruto);
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  },
  texto: (bruto: string) => bruto,
  opcao: <T extends string>(opcoes: readonly T[]) => (bruto: string) => (opcoes.includes(bruto as T) ? (bruto as T) : undefined),
};

/**
 * Filtros guardados na URL (`?mes=11&ano=2026&unidadeId=2`): o link copiado abre a tela
 * com os mesmos filtros, e o botão Voltar do navegador não desfaz filtros (usa `replace`).
 * Parâmetros que não são filtros (ex.: `?detalhe=`) são preservados.
 */
export function useFiltrosUrl<E extends Esquema>(esquema: E) {
  const [parametros, setParametros] = useSearchParams();
  const atual = useRef(esquema);
  atual.current = esquema;

  const valores = useMemo(() => {
    const saida = {} as Valores<E>;
    for (const chave of Object.keys(esquema) as (keyof E)[]) {
      const bruto = parametros.get(String(chave));
      const lido = bruto === null ? undefined : esquema[chave].ler(bruto);
      saida[chave] = lido === undefined ? esquema[chave].padrao : lido;
    }
    return saida;
    // O esquema é recriado a cada render; só os padrões importam aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros, ...Object.values(esquema).map((c) => c.padrao)]);

  const definir = useCallback((parcial: Partial<Valores<E>>) => {
    setParametros((anteriores) => {
      const novos = new URLSearchParams(anteriores);
      for (const [chave, valor] of Object.entries(parcial)) {
        const campo = atual.current[chave];
        if (!campo) continue;
        if (valor === campo.padrao || valor === null || valor === undefined || valor === '') novos.delete(chave);
        else novos.set(chave, campo.escrever ? campo.escrever(valor) : String(valor));
      }
      return novos;
    }, { replace: true });
  }, [setParametros]);

  const limpar = useCallback(() => {
    setParametros((anteriores) => {
      const novos = new URLSearchParams(anteriores);
      for (const chave of Object.keys(atual.current)) novos.delete(chave);
      return novos;
    }, { replace: true });
  }, [setParametros]);

  /** Quantos filtros estão diferentes do padrão. */
  const ativos = (Object.keys(esquema) as (keyof E)[]).filter((k) => valores[k] !== esquema[k].padrao).length;

  return { valores, definir, limpar, ativos };
}
