import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { mensagemDeErro } from '../../core/services/api';
import { PagamentosManobristasService, Pix, TipoPix } from '../../core/services/pagamentos-manobristas.service';

@Component({
  selector: 'pf-pix-manobrista',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pix" aria-label="Chave Pix">
      <h3>Chave Pix</h3>
      @if (erro()) { <p class="pf-error" role="alert">{{ erro() }}</p> }
      @if (carregando()) { <p role="status">Consultando chave Pix…</p> }
      @else {
        @if (pix(); as atual) {
          <p>{{ tipos[atual.tipo] }} · <strong>{{ atual.chaveMascarada }}</strong></p>
          @if (revelada()) {
            <div class="pf-field">
              <label class="pf-label" for="pix-revelada">Chave completa</label>
              <input class="pf-input" id="pix-revelada" readonly [value]="revelada()" (focus)="$any($event.target).select()" />
              <div class="acoes">
                <button type="button" class="pf-btn pf-btn--ghost" (click)="copiar()">Copiar chave</button>
                <button type="button" class="pf-btn pf-btn--ghost" (click)="ocultar()">Ocultar</button>
              </div>
            </div>
          }
        } @else if (!erro()) {
          <p>Nenhuma chave cadastrada.</p>
        }
        <div class="acoes">
          @if (pix() && !revelada() && !editando()) {
            <button type="button" class="pf-btn pf-btn--ghost" [disabled]="ocupado()" (click)="revelar()">Consultar chave</button>
          }
          @if (auth.nivel() === 'Proprietário' && !editando()) {
            <button type="button" class="pf-btn pf-btn--ghost" [disabled]="ocupado()" (click)="editar()">
              {{ pix() ? 'Atualizar chave' : 'Cadastrar chave' }}
            </button>
          }
        </div>
        @if (editando()) {
          <div class="pf-field">
            <label class="pf-label" for="pix-tipo">Tipo da chave</label>
            <select class="pf-select" id="pix-tipo" [(ngModel)]="tipo" [ngModelOptions]="{standalone: true}" [disabled]="ocupado()">
              @for (opcao of opcoes; track opcao) { <option [value]="opcao">{{ tipos[opcao] }}</option> }
            </select>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="pix-chave">Nova chave</label>
            <input id="pix-chave" class="pf-input" maxlength="254" autocomplete="off" [spellcheck]="false"
              [(ngModel)]="chave" [ngModelOptions]="{standalone: true}" [disabled]="ocupado()" />
          </div>
          <div class="acoes">
            <button type="button" class="pf-btn pf-btn--ghost" (click)="cancelar()" [disabled]="ocupado()">Cancelar edição</button>
            <button type="button" class="pf-btn pf-btn--dark" (click)="salvar()" [disabled]="ocupado() || !chave.trim()">Salvar chave</button>
          </div>
        }
      }
      <p role="status" class="feedback">{{ feedback() }}</p>
    </section>
  `,
  styles: [`
    .pix { display: grid; gap: 8px; padding: 12px; background: var(--pf-surface-alt); border-radius: var(--pf-radius-sm); }
    .pix h3 { font-size: 14px; }
    .pix p { font-size: 13px; overflow-wrap: anywhere; }
    .acoes { display: flex; flex-wrap: wrap; gap: 8px; }
    .pf-field .acoes { margin-top: 6px; }
    .feedback:empty, .acoes:empty { display: none; }
  `],
})
export class PixManobristaComponent implements OnInit {
  readonly manobristaId = input.required<number>();
  protected readonly auth = inject(AuthService);
  private readonly api = inject(PagamentosManobristasService);

  protected readonly tipos: Record<TipoPix, string> = {
    CPF: 'CPF', CNPJ: 'CNPJ', TELEFONE: 'Telefone celular', EMAIL: 'E-mail', ALEATORIA: 'Chave aleatória',
  };
  protected readonly opcoes = Object.keys(this.tipos) as TipoPix[];
  protected readonly pix = signal<Pix | null>(null);
  protected readonly revelada = signal('');
  protected readonly erro = signal('');
  protected readonly feedback = signal('');
  protected readonly carregando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly editando = signal(false);
  protected tipo: TipoPix = 'CPF';
  protected chave = '';

  async ngOnInit(): Promise<void> {
    try {
      this.pix.set(await this.api.consultarPix(this.manobristaId()));
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse && erro.status === 404)) this.erro.set(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  protected editar(): void {
    this.ocultar();
    this.tipo = this.pix()?.tipo ?? 'CPF';
    this.editando.set(true);
  }

  protected cancelar(): void {
    this.chave = '';
    this.erro.set('');
    this.editando.set(false);
  }

  protected ocultar(): void {
    this.revelada.set('');
    this.feedback.set('');
    this.erro.set('');
  }

  protected async salvar(): Promise<void> {
    if (!this.chave.trim() || this.ocupado()) return;
    await this.executar(async () => {
      this.pix.set(await this.api.salvarPix(this.manobristaId(), this.tipo, this.chave));
      this.cancelar();
      this.feedback.set('Chave Pix salva.');
    });
  }

  protected async revelar(): Promise<void> {
    await this.executar(async () => {
      this.revelada.set((await this.api.revelarPix(this.manobristaId())).chave);
    });
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.revelada());
      this.feedback.set('Chave copiada.');
    } catch {
      this.feedback.set('Selecione a chave completa e copie pelo teclado ou pelo menu do dispositivo.');
    }
  }

  private async executar(acao: () => Promise<void>): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.erro.set('');
    this.feedback.set('');
    try {
      await acao();
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
    } finally {
      this.ocupado.set(false);
    }
  }
}
