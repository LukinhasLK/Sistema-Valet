import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcaoFicha, Ficha, RegistroFicha } from '../models';
import { despesasDaFicha, round2 } from './calc';
import { DespesasService } from './despesas.service';
import { anoDe, diaDaSemana, DIAS_SEMANA, diaDe, Filtro, formatarData, hojeIso, mesDe, noPeriodo, Periodo } from './periodo';
import { API_URL } from './api';

const URL = `${API_URL}/fichas`;

const maisRecentePrimeiro = (a: Ficha, b: Ficha) => b.data.localeCompare(a.data) || b.id - a.id;

export interface ResumoFichas {
  fichas: number;
  carros: number;
  bruto: number;
  liquido: number;
  despesas: number;
}

export interface PontoDia {
  rotulo: string;
  valor: number;
}

export interface ResumoMes {
  mes: number;
  fichas: number;
  carros: number;
  bruto: number;
  liquido: number;
}

@Injectable({ providedIn: 'root' })
export class FichasService {
  private readonly despesasService = inject(DespesasService);
  private readonly http = inject(HttpClient);
  private readonly _fichas = signal<Ficha[]>([]);

  readonly fichas = this._fichas.asReadonly();

  async carregar(): Promise<void> {
    this._fichas.set(await firstValueFrom(this.http.get<Ficha[]>(URL)));
  }

  limpar(): void {
    this._fichas.set([]);
  }

  /** Mês aberto por padrão nas telas: o da ficha mais recente (até hoje) ou o mês atual. */
  readonly periodoReferencia = computed<Periodo>(() => {
    const hoje = hojeIso();
    const maisRecente = this._fichas()
      .map((f) => f.data)
      .filter((data) => data <= hoje)
      .sort()
      .at(-1) ?? hoje;
    return { mes: mesDe(maisRecente), ano: anoDe(maisRecente) };
  });

  /** Anos com fichas ou despesas fixas mais o ano atual, do mais recente ao mais antigo. */
  readonly anosDisponiveis = computed(() => {
    const anos = new Set([
      anoDe(hojeIso()),
      ...this._fichas().map((f) => anoDe(f.data)),
      ...this.despesasService.despesas().map((d) => anoDe(d.data)),
    ]);
    return [...anos].sort((a, b) => b - a);
  });

  detalhe(id: number) {
    return this.http.get<Ficha>(`${URL}/${id}`);
  }

  porId(id: number): Ficha | undefined {
    return this._fichas().find((f) => f.id === id);
  }

  /** Fichas do período, já ordenadas da mais recente para a mais antiga. */
  filtrar(filtro: Filtro, nomeUnidade: (id: number) => string = () => ''): Ficha[] {
    const busca = filtro.busca?.trim().toLowerCase() ?? '';

    return this._fichas()
      .filter((ficha) => noPeriodo(ficha, filtro))
      .filter((ficha) => {
        if (!busca) return true;
        return (
          nomeUnidade(ficha.unidadeId).toLowerCase().includes(busca) ||
          formatarData(ficha.data).includes(busca) ||
          ficha.data.includes(busca)
        );
      })
      .sort(maisRecentePrimeiro);
  }

  resumir(fichas: Ficha[]): ResumoFichas {
    return fichas.reduce<ResumoFichas>(
      (total, ficha) => ({
        fichas: total.fichas + 1,
        carros: total.carros + ficha.totalCarros,
        bruto: round2(total.bruto + ficha.totalBruto),
        liquido: round2(total.liquido + ficha.totalLiquido),
        despesas: round2(total.despesas + despesasDaFicha(ficha)),
      }),
      { fichas: 0, carros: 0, bruto: 0, liquido: 0, despesas: 0 }
    );
  }

  /** Série de valor líquido por dia, do início ao fim do período. */
  liquidoPorDia(fichas: Ficha[], limite = 9): PontoDia[] {
    const porDia = new Map<string, number>();

    for (const ficha of fichas) {
      porDia.set(ficha.data, round2((porDia.get(ficha.data) ?? 0) + ficha.totalLiquido));
    }

    return [...porDia.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, limite)
      .reverse()
      .map(([data, valor]) => ({ rotulo: String(diaDe(data)).padStart(2, '0'), valor }));
  }

  /** Resumo de cada mês de um ano — base dos gráficos de evolução. */
  resumoMensal(ano: number, unidadeId: number): ResumoMes[] {
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1, fichas: 0, carros: 0, bruto: 0, liquido: 0,
    }));
    const filtro = { mes: 0, ano, unidadeId };
    for (const ficha of this._fichas()) {
      if (ficha.situacao === 'CANCELADA' || !noPeriodo(ficha, filtro)) continue;
      const mes = meses[mesDe(ficha.data) - 1];
      mes.fichas++;
      mes.carros += ficha.totalCarros;
      mes.bruto = round2(mes.bruto + ficha.totalBruto);
      mes.liquido = round2(mes.liquido + ficha.totalLiquido);
    }
    return meses;
  }

  /** Dia da semana com maior faturamento bruto no período. */
  melhorDiaDaSemana(fichas: Ficha[]): { dia: string; total: number } | null {
    if (!fichas.length) return null;

    const totais = new Array(7).fill(0);
    for (const ficha of fichas) {
      const indice = DIAS_SEMANA.indexOf(diaDaSemana(ficha.data) as (typeof DIAS_SEMANA)[number]);
      totais[indice] = round2(totais[indice] + ficha.totalBruto);
    }

    const melhor = totais.indexOf(Math.max(...totais));
    return { dia: DIAS_SEMANA[melhor], total: totais[melhor] };
  }

  /** Já existe ficha para a mesma data, unidade e turno? */
  existeDuplicada(ficha: Pick<Ficha, 'data' | 'unidadeId' | 'turno'>, ignorarId?: number): boolean {
    return this._fichas().some(
      (f) => f.id !== ignorarId && f.data === ficha.data && f.unidadeId === ficha.unidadeId && f.turno === ficha.turno
    );
  }

  usaUnidade(unidadeId: number): boolean {
    return this._fichas().some((f) => f.unidadeId === unidadeId);
  }

  usaManobrista(manobristaId: number): boolean {
    return this._fichas().some((f) => f.manobristas.some((m) => m.manobristaId === manobristaId));
  }

  /** O servidor recalcula carros, bruto e líquido e devolve a ficha salva. */
  async adicionar(ficha: Omit<Ficha, 'id'>): Promise<Ficha> {
    const nova = await firstValueFrom(this.http.post<Ficha>(URL, ficha));
    this._fichas.update((lista) => [nova, ...lista].sort(maisRecentePrimeiro));
    return nova;
  }

  async atualizar(ficha: Ficha): Promise<Ficha> {
    const salva = await firstValueFrom(this.http.put<Ficha>(`${URL}/${ficha.id}`, ficha));
    this._fichas.update((lista) => lista.map((f) => (f.id === salva.id ? salva : f)).sort(maisRecentePrimeiro));
    return salva;
  }

  async transicao(id: number, acao: AcaoFicha, justificativa?: string): Promise<Ficha> {
    const ficha = await firstValueFrom(this.http.post<Ficha>(`${URL}/${id}/transicao`, { acao, justificativa }));
    this._fichas.update((lista) => lista.map((item) => item.id === id ? ficha : item));
    return ficha;
  }

  historico(id: number): Promise<RegistroFicha[]> {
    return firstValueFrom(this.http.get<RegistroFicha[]>(`${URL}/${id}/historico`));
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${URL}/${id}`));
    this._fichas.update((lista) => lista.filter((f) => f.id !== id));
  }

  /** Quantos dias cada manobrista trabalhou no mês/ano e quanto recebeu. */
  diariasPorManobrista(mes: number, ano: number): Map<number, { dias: number; total: number }> {
    const mapa = new Map<number, { dias: number; total: number }>();

    for (const ficha of this._fichas()) {
      if (anoDe(ficha.data) !== ano || (mes !== 0 && mesDe(ficha.data) !== mes)) continue;

      for (const m of ficha.manobristas) {
        const atual = mapa.get(m.manobristaId) ?? { dias: 0, total: 0 };
        mapa.set(m.manobristaId, { dias: atual.dias + 1, total: round2(atual.total + m.diaria) });
      }
    }

    return mapa;
  }
}
