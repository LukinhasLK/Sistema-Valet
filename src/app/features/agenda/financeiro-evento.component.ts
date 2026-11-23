import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL, mensagemDeErro } from '../../core/services/api';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import { DataBrPipe } from '../../shared/pipes/data-br.pipe';

type Tipo = 'FICHA' | 'DESPESA';
interface Item {
  id: number;
  data: string | null;
  descricao: string;
  valor: number | null;
  vinculado: boolean;
  elegivel: boolean;
}
interface Total {
  valor: number;
  validos: number;
  vinculados: number;
}
interface Conciliacao {
  fichas: Total;
  despesas: Total;
  resultado: number;
  itens: Item[];
  mais: boolean;
  cancelado: boolean;
}

@Component({
  selector: 'pf-financeiro-evento',
  imports: [ModalComponent, CurrencyBrPipe, DataBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pf-btn pf-btn--ghost" (click)="abrir()">Financeiro</button>
    @if (aberto()) {
      <pf-modal [title]="'Financeiro · ' + nome()" [wide]="true" (fechar)="fechar()">
        <p>Vincule fichas fechadas e despesas da unidade no período do evento. Cada registro pode entrar em um único evento. Selecione despesas que ainda não estejam no líquido da ficha.</p>
        @if (dados(); as d) {
          <dl class="resumo" aria-label="Resultado realizado">
            <div><dt>Líquido das fichas</dt><dd>{{ d.fichas.valor | currencyBr }}</dd></div>
            <div><dt>Despesas vinculadas</dt><dd>{{ d.despesas.valor | currencyBr }}</dd></div>
            <div><dt>Resultado realizado</dt>
              <dd>{{ d.fichas.validos + d.despesas.validos ? (d.resultado | currencyBr) : 'Sem lançamentos' }}</dd></div>
          </dl>
          @if (d.fichas.vinculados + d.despesas.vinculados > d.fichas.validos + d.despesas.validos) {
            <p role="status">Há vínculos fora da conciliação. Confira os registros reabertos, cancelados ou fora do período.</p>
          }
        }
        <label class="pf-field">
          <span class="pf-label">Tipo de lançamento</span>
          <select class="pf-select" [value]="tipo()" [disabled]="alterando()" (change)="mudarTipo($event)">
            <option value="FICHA">Fichas</option><option value="DESPESA">Despesas</option>
          </select>
        </label>
        @if (erro()) {
          <p class="pf-error" role="alert">{{ erro() }}</p>
          <button type="button" class="pf-btn pf-btn--ghost" (click)="carregar()">Atualizar lista</button>
        }
        @if (carregando()) {
          <p role="status">Carregando lançamentos…</p>
        } @else {
          @if (dados(); as d) {
            <ul aria-label="Lançamentos">
              @for (item of d.itens; track item.id) {
                <li>
                  <div>
                    <strong>{{ item.descricao }}</strong>
                    @if (item.data) { <p>{{ item.data | dataBr }} · {{ item.valor | currencyBr }}</p> }
                    @if (item.vinculado) { <p>{{ item.elegivel ? 'Vinculado' : 'Fora da conciliação' }}</p> }
                  </div>
                  <button type="button" class="pf-btn pf-btn--ghost"
                    [disabled]="alterando() || (d.cancelado && !item.vinculado)"
                    [attr.aria-label]="(item.vinculado ? 'Remover vínculo de ' : 'Vincular ') + item.descricao + ' #' + item.id"
                    (click)="alternar(item)">{{ item.vinculado ? 'Remover vínculo' : 'Vincular' }}</button>
                </li>
              } @empty {
                <li>Não há lançamentos elegíveis neste recorte.</li>
              }
            </ul>
            @if (pagina() > 0 || d.mais) {
              <nav aria-label="Páginas dos lançamentos">
                <button type="button" class="pf-btn pf-btn--ghost" [disabled]="!pagina() || alterando()"
                  (click)="mudarPagina(-1)">Anterior</button>
                <span>Página {{ pagina() + 1 }}</span>
                <button type="button" class="pf-btn pf-btn--ghost" [disabled]="!d.mais || alterando()"
                  (click)="mudarPagina(1)">Próxima</button>
              </nav>
            }
          }
        }
      </pf-modal>
    }
  `,
  styles: [`
    ul { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 8px; }
    li, nav { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    li { padding: 10px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); }
    .resumo { display: grid; gap: 6px; margin-block: 12px; }
    .resumo div { display: flex; gap: 8px; justify-content: space-between; }
    .resumo dd { margin: 0; font-weight: 700; }
    p, label { margin-bottom: 8px; }
  `],
})
export class FinanceiroEventoComponent {
  readonly id = input.required<number>();
  readonly nome = input.required<string>();
  private readonly http = inject(HttpClient);
  private requisicao = 0;
  protected readonly aberto = signal(false);
  protected readonly alterando = signal(false);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly dados = signal<Conciliacao | null>(null);
  protected readonly tipo = signal<Tipo>('FICHA');
  protected readonly pagina = signal(0);

  private get url(): string { return `${API_URL}/eventos/${this.id()}/financeiro`; }

  protected abrir(): void {
    this.dados.set(null);
    this.pagina.set(0);
    this.tipo.set('FICHA');
    this.aberto.set(true);
    void this.carregar();
  }

  protected fechar(): void {
    this.requisicao++;
    this.aberto.set(false);
  }

  protected mudarTipo(evento: Event): void {
    this.tipo.set((evento.target as HTMLSelectElement).value as Tipo);
    this.pagina.set(0);
    void this.carregar();
  }

  protected mudarPagina(delta: number): void {
    this.pagina.update(valor => valor + delta);
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    const requisicao = ++this.requisicao;
    this.carregando.set(true);
    this.erro.set('');
    try {
      const dados = await firstValueFrom(this.http.get<Conciliacao>(this.url,
        { params: { tipo: this.tipo(), pagina: this.pagina() } }));
      if (requisicao === this.requisicao) this.dados.set(dados);
    } catch (erro) {
      if (requisicao === this.requisicao) {
        this.dados.set(null);
        this.erro.set(mensagemDeErro(erro));
      }
    } finally {
      if (requisicao === this.requisicao) this.carregando.set(false);
    }
  }

  protected async alternar(item: Item): Promise<void> {
    if (this.alterando() || this.carregando()) return;
    this.alterando.set(true);
    this.erro.set('');
    const url = `${this.url}/${this.tipo()}/${item.id}`;
    try {
      await firstValueFrom(item.vinculado ? this.http.delete<void>(url) : this.http.put<void>(url, {}));
      if (this.aberto()) {
        this.pagina.set(0);
        await this.carregar();
      }
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
    } finally {
      this.alterando.set(false);
    }
  }
}
