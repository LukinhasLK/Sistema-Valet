import { render } from '@testing-library/react';
import { Chart, ChartConfiguration } from 'chart.js';
import { vi } from 'vitest';
import { Grafico } from '../Grafico';

// jsdom não desenha canvas: o Chart.js é observado, não executado.
vi.mock('chart.js', async (original) => {
  const real = await original<typeof import('chart.js')>();
  const criados: unknown[] = [];
  class ChartFalso {
    data: unknown; options: unknown; destruido = false; atualizacoes = 0;
    constructor(_: unknown, config: ChartConfiguration) { this.data = config.data; this.options = config.options; criados.push(this); }
    update() { this.atualizacoes++; }
    destroy() { this.destruido = true; }
    static register() {}
    static criados = criados;
  }
  return { ...real, Chart: ChartFalso, registerables: [] };
});

const barras = (valores: number[]): ChartConfiguration => ({
  type: 'bar', data: { labels: valores.map((_, i) => `M${i + 1}`), datasets: [{ label: 'Líquido', data: valores }] }, options: {},
});

describe('Grafico', () => {
  it('atualiza o mesmo gráfico quando os dados chegam, sem recriar (a animação não reinicia)', () => {
    const criados = (Chart as unknown as { criados: { destruido: boolean; atualizacoes: number; data: ChartConfiguration['data'] }[] }).criados;
    const { rerender } = render(<Grafico config={barras([])} />);
    expect(criados.length).toBe(1);
    rerender(<Grafico config={barras([100, 250, 175])} />);
    expect(criados.length).toBe(1);
    expect(criados[0].destruido).toBe(false);
    expect(criados[0].atualizacoes).toBe(1);
    expect(criados[0].data.datasets[0].data).toEqual([100, 250, 175]);
  });
});
