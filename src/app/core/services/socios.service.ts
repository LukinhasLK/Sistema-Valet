import { HttpClient } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Socio } from '../models';
import { API_URL } from './api';
import { UnidadesService } from './unidades.service';

const URL = `${API_URL}/socios`;

export interface RevisaoRateio {
  id: number;
  vigenteDesde: string;
  autor: string;
  criadoEm: string;
}

export interface CotaRateio {
  socioId: number;
  percentual: number;
}

export interface TotalUnidade {
  unidadeId: number;
  unidade: string;
  total: number;
  /** Fecha em 100% — pronto para dividir lucro. */
  valido: boolean;
  /** Ainda sem nenhum sócio: pendente, não é erro. */
  vazia: boolean;
}

@Injectable({ providedIn: 'root' })
export class SociosService {
  private readonly unidadesService = inject(UnidadesService);
  private readonly http = inject(HttpClient);
  private readonly _socios = signal<Socio[]>([]);

  readonly socios = this._socios.asReadonly();

  async carregar(): Promise<void> {
    this._socios.set(await firstValueFrom(this.http.get<Socio[]>(URL)));
  }

  limpar(): void {
    this._socios.set([]);
  }

  /** Soma dos percentuais por unidade — precisa fechar em 100%. */
  readonly totaisPorUnidade = computed<TotalUnidade[]>(() =>
    this.unidadesService.unidades().map(({ id, nome }) => {
      const centavos = this._socios().reduce(
        (soma, socio) => soma + Math.round((socio.percentuais.find((p) => p.unidadeId === id)?.percentual ?? 0) * 100),
        0
      );
      return { unidadeId: id, unidade: nome, total: centavos / 100, valido: centavos === 10000, vazia: centavos === 0 };
    })
  );

  /** Apenas as unidades que já têm rateio configurado. */
  readonly unidadesConfiguradas = computed(() =>
    this.totaisPorUnidade().filter((t) => t.total > 0)
  );

  percentual(socio: Socio, unidadeId: number): number | null {
    return socio.percentuais.find((p) => p.unidadeId === unidadeId)?.percentual ?? null;
  }

  sociosDaUnidade(unidadeId: number): Socio[] {
    return this._socios().filter((s) => s.percentuais.some((p) => p.unidadeId === unidadeId && p.percentual > 0));
  }

  async salvarSocio(socio: { nome: string; id?: number }): Promise<void> {
    const corpo = { nome: socio.nome };
    await firstValueFrom(
      socio.id ? this.http.put<Socio>(`${URL}/${socio.id}`, corpo) : this.http.post<Socio>(URL, corpo)
    );
    await this.carregar();
  }

  listarCotas(unidadeId: number, data: string): Promise<CotaRateio[]> {
    return firstValueFrom(this.http.get<CotaRateio[]>(`${URL}/rateio/${unidadeId}`, { params: { data } }));
  }

  historicoRateio(unidadeId: number): Promise<RevisaoRateio[]> {
    return firstValueFrom(this.http.get<RevisaoRateio[]>(`${URL}/rateio/${unidadeId}/historico`));
  }

  async configurarRateio(unidadeId: number, vigenteDesde: string, partes: CotaRateio[]): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${URL}/rateio/${unidadeId}`, { vigenteDesde, partes }));
    await this.carregar();
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${URL}/${id}`));
    this._socios.update((lista) => lista.filter((s) => s.id !== id));
  }
}
