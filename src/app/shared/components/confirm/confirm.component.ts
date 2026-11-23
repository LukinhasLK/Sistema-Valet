import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'pf-confirm',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pf-modal [title]="title()" (fechar)="cancelar.emit()">
      <p class="msg">{{ message() }}</p>
      <div class="acoes">
        <button type="button" class="pf-btn pf-btn--ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="button" class="pf-btn danger" (click)="confirmar.emit()">{{ confirmLabel() }}</button>
      </div>
    </pf-modal>
  `,
  styles: [`
    .msg { color: var(--pf-text-muted); font-size: 14px; }
    .acoes { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .danger {
      background: var(--pf-danger);
      color: #fff;
      &:hover { background: #dc2626; }
    }
  `],
})
export class ConfirmComponent {
  readonly title = input('Confirmar exclusão');
  readonly message = input.required<string>();
  readonly confirmLabel = input('Excluir');
  readonly confirmar = output<void>();
  readonly cancelar = output<void>();
}
