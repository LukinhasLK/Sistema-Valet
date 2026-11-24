import { resumirFichas, ResumoFichas } from '../../nucleo/estado/fichas';
import { Ficha, SituacaoFicha } from '../../nucleo/modelos';
import { ORDEM_SITUACAO_FICHA, rotuloSituacao } from '../../compartilhado/Situacao';

export type ModoAgrupar = 'situacao' | 'dia' | 'nenhum';
export const MODOS_AGRUPAR: readonly ModoAgrupar[] = ['situacao', 'dia', 'nenhum'];

export interface GrupoFichas {
  chave: string;
  titulo: string;
  situacao?: SituacaoFicha;
  fichas: Ficha[];
  resumo: ResumoFichas;
}

const DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "2026-11-24" → "Terça-feira, 24 de novembro". */
export function tituloDoDia(dataIso: string): string {
  const texto = DIA.format(new Date(`${dataIso}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Dia da semana curto ("seg", "ter"…), para as linhas da lista. */
export function diaCurto(dataIso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dataIso}T12:00:00Z`)).replace('.', '');
}

export const situacaoDe = (ficha: Ficha): SituacaoFicha => ficha.situacao ?? 'EM_EDICAO';

/**
 * Agrupa as fichas (já ordenadas da mais recente para a mais antiga) sem reordenar dentro do grupo.
 * Por situação, a ordem segue o fluxo de trabalho: o que precisa de conferência vem primeiro.
 */
export function agruparFichas(fichas: Ficha[], modo: ModoAgrupar): GrupoFichas[] {
  if (modo === 'nenhum') return fichas.length ? [{ chave: 'todas', titulo: 'Todas as fichas', fichas, resumo: resumirFichas(fichas) }] : [];
  if (modo === 'situacao') {
    return ORDEM_SITUACAO_FICHA
      .map((situacao) => {
        const doGrupo = fichas.filter((f) => situacaoDe(f) === situacao);
        return { chave: situacao, titulo: rotuloSituacao(situacao), situacao, fichas: doGrupo, resumo: resumirFichas(doGrupo) };
      })
      .filter((g) => g.fichas.length);
  }
  const porDia = new Map<string, Ficha[]>();
  for (const f of fichas) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f]);
  return [...porDia.entries()].map(([data, doDia]) => ({ chave: data, titulo: tituloDoDia(data), fichas: doDia, resumo: resumirFichas(doDia) }));
}
