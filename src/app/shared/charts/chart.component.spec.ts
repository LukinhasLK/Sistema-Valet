import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chart, ChartConfiguration } from 'chart.js';
import { ChartComponent } from './chart.component';

const barras = (valores: number[]): ChartConfiguration => ({
  type: 'bar',
  data: { labels: valores.map((_, i) => `M${i + 1}`), datasets: [{ label: 'Líquido', data: valores }] },
  options: { animation: false },
});

@Component({
  standalone: true,
  imports: [ChartComponent],
  template: `<pf-chart [config]="config()" />`,
})
class HostComponent {
  readonly config = signal<ChartConfiguration>(barras([]));
}

describe('ChartComponent', () => {
  function graficoDe(fixture: { nativeElement: HTMLElement }): Chart {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    return Chart.getChart(canvas)!;
  }

  it('atualiza o mesmo gráfico quando os dados chegam, sem recriar (a animação não reinicia)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const primeiro = graficoDe(fixture);
    expect(primeiro).toBeDefined();
    const destruir = spyOn(primeiro, 'destroy').and.callThrough();

    fixture.componentInstance.config.set(barras([100, 250, 175]));
    fixture.detectChanges();

    expect(graficoDe(fixture)).toBe(primeiro);
    expect(destruir).not.toHaveBeenCalled();
    expect(primeiro.data.datasets[0].data).toEqual([100, 250, 175]);
    expect(primeiro.data.labels).toEqual(['M1', 'M2', 'M3']);
  });

  it('recria quando o tipo do gráfico muda', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const primeiro = graficoDe(fixture);

    fixture.componentInstance.config.set({ ...barras([1, 2]), type: 'line' });
    fixture.detectChanges();

    const segundo = graficoDe(fixture);
    expect(segundo).not.toBe(primeiro);
    expect((segundo.config as ChartConfiguration).type).toBe('line');
  });

  it('libera o canvas ao sair da tela', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    fixture.destroy();
    expect(Chart.getChart(canvas)).toBeUndefined();
  });
});
