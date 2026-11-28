import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL, mensagemDeErro } from '../../../core/services/api';
import { ModalComponent } from '../modal/modal.component';

interface Alteracao {
  id: number;
  ator: string;
  campo: string;
  anterior: string | null;
  atual: string | null;
  registradoEm: string;
}

@Component({
  selector: 'pf-historico-administrativo',
  imports: [DatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pf-btn pf-btn--ghost" (click)="abrir()" [attr.aria-label]="'Histórico de ' + nome()">
      Histórico
    </button>
    @if (aberto()) {
      <pf-modal [title]="'Histórico · ' + nome()" (fechar)="fechar()">
        @if (erro()) {
          <p class="pf-error" role="alert">{{ erro() }}</p>
          <button type="button" class="pf-btn pf-btn--ghost" (click)="carregar()">Tentar novamente</button>
        }
        <ol aria-label="Alterações administrativas">
          @for (item of itens(); track item.id) {
            <li>
              <strong>{{ item.campo }}</strong>
              <p>{{ item.anterior ?? '—' }} → {{ item.atual ?? '—' }}</p>
              <small>{{ item.ator }} · {{ item.registradoEm | date:'dd/MM/yyyy HH:mm':'-0300' }}</small>
            </li>
          } @empty {
            @if (!carregando() && !erro()) { <li>Nenhuma alteração detalhada registrada.</li> }
          }
        </ol>
        @if (carregando()) {
          <p role="status">Carregando alterações…</p>
        } @else if (proximo() !== null && !erro()) {
          <button type="button" class="pf-btn pf-btn--ghost" (click)="carregar()">Ver alterações anteriores</button>
        }
      </pf-modal>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    ol:empty { display: none; }
    li { padding: 10px; border-radius: var(--pf-radius-sm); background: var(--pf-surface-alt); }
    small { color: var(--pf-text-muted); }
    ol + button { margin-top: 10px; }
  `],
})
export class HistoricoAdministrativoComponent {
  readonly id = input.required<number>();
  readonly nome = input.required<string>();
  readonly tipo = input.required<'usuarios' | 'unidades'>();
  private readonly http = inject(HttpClient);
  private requisicao = 0;
  protected readonly aberto = signal(false);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly itens = signal<Alteracao[]>([]);
  protected readonly proximo = signal<number | null>(null);

  protected abrir(): void {
    this.itens.set([]);
    this.proximo.set(null);
    this.aberto.set(true);
    void this.carregar();
  }

  protected fechar(): void {
    this.requisicao++;
    this.carregando.set(false);
    this.aberto.set(false);
  }

  protected async carregar(): Promise<void> {
    if (this.carregando()) return;
    const requisicao = ++this.requisicao;
    this.erro.set('');
    this.carregando.set(true);
    try {
      const antes = this.proximo();
      const pagina = await firstValueFrom(this.http.get<{ itens: Alteracao[]; proximo: number | null }>(
        `${API_URL}/${this.tipo()}/${this.id()}/auditoria`, { params: antes === null ? {} : { antes } },
      ));
      if (this.requisicao !== requisicao) return;
      this.itens.update(itens => [...itens, ...pagina.itens]);
      this.proximo.set(pagina.proximo);
    } catch (erro) {
      if (this.requisicao === requisicao) this.erro.set(mensagemDeErro(erro));
    } finally {
      if (this.requisicao === requisicao) this.carregando.set(false);
    }
  }
}
