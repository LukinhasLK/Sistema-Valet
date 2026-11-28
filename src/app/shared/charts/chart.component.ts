import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  untracked,
  viewChild,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { movimentoReduzido } from '../motion/motion';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

/**
 * Envelope fino sobre o Chart.js. Quando a configuração muda (ex.: os dados
 * chegam em partes ao abrir a tela), o gráfico existente é ATUALIZADO, não
 * recriado — assim a animação não recomeça do zero a cada carga. O Chart.js
 * roda fora da zona do Angular para que cada quadro de animação não dispare
 * detecção de mudanças na aplicação inteira.
 */
@Component({
  selector: 'pf-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="holder" [style.height.px]="height()">
      <canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas>
    </div>
  `,
  styles: [':host { display: block; } .holder { position: relative; width: 100%; }'],
})
export class ChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly height = input(260);
  readonly ariaLabel = input('Gráfico');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly preferencias = inject(BreakpointObserver);
  private readonly reduzir = toSignal(this.preferencias.observe(movimentoReduzido).pipe(map(({ matches }) => matches)), {
    initialValue: this.preferencias.isMatched(movimentoReduzido),
  });
  private readonly zone = inject(NgZone);
  private chart?: Chart;
  private tipo?: ChartConfiguration['type'];

  constructor() {
    effect(() => {
      const config = this.config();
      const elemento = this.canvas().nativeElement;
      const final: ChartConfiguration = this.reduzir()
        ? { ...config, options: { ...config.options, animation: false } }
        : config;

      untracked(() => this.zone.runOutsideAngular(() => this.desenhar(elemento, final)));
    });
  }

  private desenhar(elemento: HTMLCanvasElement, config: ChartConfiguration): void {
    const atual = this.chart;
    if (atual && this.tipo === config.type) {
      // Mesmo tipo: troca dados e opções e anima a transição a partir do estado atual.
      atual.data = config.data;
      atual.options = config.options ?? {};
      atual.update();
      return;
    }
    atual?.destroy();
    this.chart = new Chart(elemento, config);
    this.tipo = config.type;
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => this.chart?.destroy());
    this.chart = undefined;
  }
}
