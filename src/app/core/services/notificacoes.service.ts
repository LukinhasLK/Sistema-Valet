import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, fromEvent, map, merge, of, switchMap, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { API_URL } from './api';
import { podeAcessar } from './permissoes';

const URL = `${API_URL}/notificacoes`;
export const CATEGORIAS = {
  FICHA_CRIADA: 'Ficha registrada',
  FICHA_AGUARDANDO_FECHAMENTO: 'Ficha aguardando fechamento',
  PAGAMENTO_PENDENTE: 'Pagamento pendente',
  PAGAMENTO_CONFIRMADO: 'Pagamento confirmado',
  DIVERGENCIA_FINANCEIRA: 'Divergência financeira',
  EVENTO_PROXIMO: 'Evento próximo',
  ESCALA_ALTERADA: 'Escala alterada',
};
export type Categoria = keyof typeof CATEGORIAS;

export interface Notificacao {
  id: number;
  categoria: Categoria;
  titulo: string;
  destino: 'FICHA' | 'PAGAMENTO' | 'EVENTO' | 'ESCALA';
  destinoId: number;
  criadoEm: string;
  lida: boolean;
}

export interface PreferenciaNotificacao {
  categoria: Categoria;
  ativa: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly recarga = new Subject<void>();
  readonly disponivel = computed(() => podeAcessar(this.auth.nivel(), 'notificacoes'));
  private readonly conta = computed(() => this.disponivel() ? (this.auth.usuario()?.id ?? null) : null);
  private readonly sinaisWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? new Observable<void>((o) => {
        const receber = (e: MessageEvent) => {
          if (e.data?.tipo === 'PARKFLASH_NOTIFICACAO') o.next();
        };
        navigator.serviceWorker.addEventListener('message', receber);
        return () => navigator.serviceWorker.removeEventListener('message', receber);
      }) : EMPTY;

  readonly total = toSignal(toObservable(this.conta).pipe(
    switchMap((id) => id === null ? of(null) : merge(
      timer(0, 30_000), this.recarga, this.sinaisWorker, fromEvent(window, 'focus'),
    ).pipe(
      switchMap(() => this.http.get<{ total: number }>(`${URL}/pendentes`).pipe(
        map((r) => r.total), catchError(() => of(null)),
      )),
    )),
  ), { initialValue: null });

  atualizarContador(): void { this.recarga.next(); }

  listar(soNaoLidas: boolean, antes?: number) {
    let params = new HttpParams().set('naoLidas', soNaoLidas);
    if (antes !== undefined) params = params.set('antes', antes);
    return this.http.get<Notificacao[]>(URL, { params });
  }

  ler(id?: number) {
    return this.http.put<void>(id === undefined ? `${URL}/leitura` : `${URL}/${id}/leitura`, {});
  }

  preferencias() { return this.http.get<PreferenciaNotificacao[]>(`${URL}/preferencias`); }

  preferir(categoria: Categoria, ativa: boolean) {
    return this.http.put<void>(`${URL}/preferencias/${categoria}`, { ativa });
  }

  divergencia(ficha: number, motivo: string) {
    return this.http.post<void>(`${URL}/divergencias/${ficha}`, { motivo });
  }
}
