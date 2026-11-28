import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { TipoPix } from './pagamentos-manobristas.service';
import { Manobrista } from '../models';
import { API_URL } from './api';

const URL = `${API_URL}/manobristas`;

@Injectable({ providedIn: 'root' })
export class ManobristasService {
  private readonly http = inject(HttpClient);
  private readonly _manobristas = signal<Manobrista[]>([]);

  readonly manobristas = this._manobristas.asReadonly();
  readonly nomes = computed(() => this._manobristas().map((m) => m.nome));

  async carregar(): Promise<void> {
    this._manobristas.set(await firstValueFrom(this.http.get<Manobrista[]>(URL)));
  }

  limpar(): void {
    this._manobristas.set([]);
  }

  nome(id: number): string {
    return this._manobristas().find((m) => m.id === id)?.nome ?? '—';
  }

  async salvarManobrista(manobrista: Omit<Manobrista, 'id'> & { id?: number; pix?: { tipo: TipoPix; chave: string } }): Promise<Manobrista> {
    const salvo = await firstValueFrom(
      manobrista.id
        ? this.http.put<Manobrista>(`${URL}/${manobrista.id}`, manobrista)
        : this.http.post<Manobrista>(URL, manobrista)
    );
    this._manobristas.update((lista) =>
      manobrista.id ? lista.map((m) => (m.id === salvo.id ? salvo : m)) : [...lista, salvo]
    );
    return salvo;
  }

  async desativar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${URL}/${id}`));
    this._manobristas.update((lista) => lista.map((m) => m.id === id ? { ...m, ativo: false } : m));
  }
}
