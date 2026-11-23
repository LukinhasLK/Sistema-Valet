import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Unidade } from '../models';
import { API_URL } from './api';

const URL = `${API_URL}/unidades`;

@Injectable({ providedIn: 'root' })
export class UnidadesService {
  private readonly http = inject(HttpClient);
  private readonly _unidades = signal<Unidade[]>([]);

  readonly unidades = this._unidades.asReadonly();
  readonly nomes = computed(() => this._unidades().map((u) => u.nome));

  async carregar(): Promise<void> {
    this._unidades.set(await firstValueFrom(this.http.get<Unidade[]>(URL)));
  }

  limpar(): void {
    this._unidades.set([]);
  }

  /** Nome para exibição; registros antigos de uma unidade removida aparecem como "—". */
  nome(id: number): string {
    return this._unidades().find((u) => u.id === id)?.nome ?? '—';
  }

  async salvarUnidade(unidade: Omit<Unidade, 'id'> & { id?: number }): Promise<Unidade> {
    const salva = await firstValueFrom(
      unidade.id ? this.http.put<Unidade>(`${URL}/${unidade.id}`, unidade) : this.http.post<Unidade>(URL, unidade)
    );
    this._unidades.update((lista) =>
      unidade.id ? lista.map((u) => (u.id === salva.id ? salva : u)) : [...lista, salva]
    );
    return salva;
  }

  /** A unidade desativada continua disponível para filtros e referências históricas. */
  async desativar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${URL}/${id}`));
    this._unidades.update((lista) => lista.map((u) => u.id === id ? { ...u, ativa: false } : u));
  }
}
