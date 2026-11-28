import { ReactNode } from 'react';
import { Unidade } from '../nucleo/modelos';
import { MESES, TODAS_UNIDADES } from '../nucleo/servicos/periodo';
import { FiltroPilula } from './BarraFiltros';
import { useFiltrosUrl } from './useFiltrosUrl';

interface Opcoes {
  mesPadrao: number;
  anoPadrao: number;
  anos: number[];
  /** Rótulo da opção "todos os meses" (ex.: "Ano inteiro"); omitido = mês obrigatório. */
  rotuloTodosMeses?: string;
  /** Lista de unidades; omitida = sem filtro de unidade. */
  unidades?: Unidade[];
  unidadePadrao?: number;
  /** Rótulo da opção "todas as unidades" (ex.: "Consolidado"); omitido = unidade obrigatória. */
  rotuloTodasUnidades?: string;
}

/**
 * Filtro de período (mês, ano e unidade) guardado na URL, com as mesmas etiquetas de Fichas.
 * Devolve as variáveis com os nomes de antes (mes/setMes…), para trocar o useState sem mexer no resto da tela.
 */
export function useFiltroPeriodo(o: Opcoes) {
  const unidadePadrao = o.unidadePadrao ?? TODAS_UNIDADES;
  const filtros = useFiltrosUrl({
    mes: { padrao: o.mesPadrao, ler: (b: string) => { const n = Number(b); return Number.isInteger(n) && n >= (o.rotuloTodosMeses ? 0 : 1) && n <= 12 ? n : undefined; } },
    ano: { padrao: o.anoPadrao, ler: (b: string) => { const n = Number(b); return o.anos.includes(n) ? n : undefined; } },
    unidadeId: {
      padrao: unidadePadrao,
      ler: (b: string) => {
        const n = Number(b);
        if (o.rotuloTodasUnidades && n === TODAS_UNIDADES) return n;
        return o.unidades?.some((u) => u.id === n) ? n : undefined;
      },
    },
  });
  const { mes, ano, unidadeId } = filtros.valores;

  const etiquetas: ReactNode = (
    <>
      <FiltroPilula rotulo="Mês" icone="eventos" valor={mes} padrao={o.mesPadrao}
        opcoes={[...(o.rotuloTodosMeses ? [{ valor: 0, rotulo: o.rotuloTodosMeses }] : []), ...MESES.map((nome, i) => ({ valor: i + 1, rotulo: nome }))]}
        aoMudar={(v) => filtros.definir({ mes: v })} />
      <FiltroPilula rotulo="Ano" valor={ano} padrao={o.anoPadrao} opcoes={o.anos.map((a) => ({ valor: a, rotulo: String(a) }))}
        aoMudar={(v) => filtros.definir({ ano: v })} />
      {o.unidades && (
        <FiltroPilula rotulo="Unidade" icone="unidades" valor={unidadeId} padrao={unidadePadrao}
          opcoes={[...(o.rotuloTodasUnidades ? [{ valor: TODAS_UNIDADES, rotulo: o.rotuloTodasUnidades }] : []), ...o.unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))]}
          aoMudar={(v) => filtros.definir({ unidadeId: v })} />
      )}
    </>
  );

  return {
    mes, ano, unidadeId,
    setMes: (v: number) => filtros.definir({ mes: v }),
    setAno: (v: number) => filtros.definir({ ano: v }),
    setUnidadeId: (v: number) => filtros.definir({ unidadeId: v }),
    ativos: filtros.ativos,
    limpar: filtros.limpar,
    etiquetas,
  };
}
