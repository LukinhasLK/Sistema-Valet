import { ChangeDetectionStrategy, Component, Signal, computed, input, linkedSignal, output } from '@angular/core';

const TAMANHO = 25;

export function paginar<T>(itens: Signal<T[]>) {
  const pagina = linkedSignal(() => { itens(); return 0; });
  const visiveis = computed(() => itens().slice(pagina() * TAMANHO, (pagina() + 1) * TAMANHO));
  const paginas = computed(() => Math.ceil(itens().length / TAMANHO));
  return { pagina, visiveis, paginas };
}

@Component({
  selector: 'pf-paginacao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paginas() > 1) {
      <nav aria-label="Paginação">
        <button type="button" class="pf-btn pf-btn--ghost" [disabled]="pagina() === 0"
          (click)="selecionar.emit(pagina() - 1)">Anterior</button>
        <span aria-live="polite">Página {{ pagina() + 1 }} de {{ paginas() }}</span>
        <button type="button" class="pf-btn pf-btn--ghost" [disabled]="pagina() + 1 >= paginas()"
          (click)="selecionar.emit(pagina() + 1)">Próxima</button>
      </nav>
    }
  `,
  styles: ['nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; padding-block: 12px; }'],
})
export class PaginacaoComponent {
  readonly pagina = input.required<number>();
  readonly paginas = input.required<number>();
  readonly selecionar = output<number>();
}
