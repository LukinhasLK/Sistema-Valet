import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, afterNextRender, inject, input, output, viewChild,
} from '@angular/core';
import { entrada, saida } from '../../motion/motion';

@Component({
  selector: 'pf-modal',
  standalone: true,
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #fundo class="backdrop" (click)="solicitarFechamento()">
      <div
        #painel
        class="sheet"
        [class.sheet--wide]="wide()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
        (keydown.escape)="solicitarFechamento($event)"
      >
        <header class="sheet__head">
          <h2 class="sheet__title">{{ title() }}</h2>
          <button type="button" cdkFocusInitial class="sheet__close" aria-label="Fechar" (click)="solicitarFechamento()">×</button>
        </header>
        <div class="sheet__body">
          <ng-content />
        </div>
        <footer class="sheet__footer"><ng-content select="[pfModalFooter]" /></footer>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(17, 24, 39, .55);
      display: grid;
      place-items: center;
      padding: 20px;
      z-index: 100;
    }
    .sheet {
      --sheet-inset: clamp(14px, 4vw, 22px);
      background: var(--pf-surface);
      border-radius: var(--pf-radius-lg);
      box-shadow: var(--pf-shadow-lg);
      width: min(100%, 480px);
      min-width: 0;
      max-height: calc(100vh - 40px);
      max-height: calc(100dvh - 40px);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
      white-space: normal;
      text-align: start;
    }
    .sheet--wide { width: min(100%, 620px); }
    .sheet__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px var(--sheet-inset);
      border-bottom: 1px solid var(--pf-border);
    }
    .sheet__title { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
    .sheet__close {
      display: grid;
      place-items: center;
      flex: 0 0 44px;
      height: 44px;
      background: none;
      border: none;
      border-radius: var(--pf-radius-sm);
      font-size: 26px;
      line-height: 1;
      color: var(--pf-text-muted);
      cursor: pointer;
      &:hover { color: var(--pf-text); background: var(--pf-surface-alt); }
    }
    .sheet__body {
      min-width: 0;
      padding: 18px var(--sheet-inset);
      overflow-y: auto;
      overscroll-behavior: contain;
      overflow-wrap: anywhere;
    }
    .sheet__footer {
      min-width: 0;
      padding: 12px var(--sheet-inset);
      border-top: 1px solid var(--pf-border);
    }
    .sheet__footer:empty { display: none; }

    @media (max-width: 767px) {
      .backdrop { align-items: end; padding: 0; }
      .sheet {
        width: 100%;
        border-radius: var(--pf-radius-lg) var(--pf-radius-lg) 0 0;
        max-height: calc(100vh - 12px);
        max-height: calc(100dvh - max(12px, env(safe-area-inset-top)));
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
    @media (max-height: 320px) {
      .sheet {
        display: block;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .sheet__body { overflow: visible; }
    }
  `],
})
export class ModalComponent implements OnDestroy {
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly fechar = output<void>();
  private readonly zone = inject(NgZone);
  private readonly fundo = viewChild.required<ElementRef<HTMLElement>>('fundo');
  private readonly painel = viewChild.required<ElementRef<HTMLElement>>('painel');
  private cancelarEntrada?: () => void;
  private cancelarSaida?: () => void;
  private fechando = false;
  private readonly render = afterNextRender(() => {
    this.zone.runOutsideAngular(() => {
      const cancelarFundo = entrada([this.fundo().nativeElement], 0);
      const cancelarPainel = entrada([this.painel().nativeElement]);
      this.cancelarEntrada = () => { cancelarFundo(); cancelarPainel(); };
    });
  });

  protected solicitarFechamento(evento?: Event): void {
    evento?.stopPropagation();
    if (this.fechando) return;
    this.fechando = true;
    this.cancelarEntrada?.();
    this.cancelarSaida = this.zone.runOutsideAngular(() => saida(
      this.fundo().nativeElement, this.painel().nativeElement, () => this.zone.run(() => this.fechar.emit()),
    ));
  }

  ngOnDestroy(): void {
    this.render.destroy();
    this.cancelarEntrada?.();
    this.cancelarSaida?.();
  }
}
