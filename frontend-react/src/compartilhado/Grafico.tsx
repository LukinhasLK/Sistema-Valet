import { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { useMovimentoReduzido } from '../nucleo/estado/layout';

Chart.register(...registerables);

interface Props {
  config: ChartConfiguration;
  altura?: number;
  rotulo?: string;
}

/**
 * Envelope fino sobre o Chart.js. Quando a configuração muda (ex.: os dados chegam
 * em partes ao abrir a tela), o gráfico existente é ATUALIZADO, não recriado —
 * assim a animação não recomeça do zero a cada carga.
 */
export function Grafico({ config, altura = 260, rotulo = 'Gráfico' }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const grafico = useRef<Chart>();
  const tipo = useRef<ChartConfiguration['type']>();
  const reduzir = useMovimentoReduzido();

  useEffect(() => {
    const final: ChartConfiguration = reduzir ? { ...config, options: { ...config.options, animation: false } } : config;
    const atual = grafico.current;
    if (atual && tipo.current === final.type) {
      // Mesmo tipo: troca dados e opções e anima a transição a partir do estado atual.
      atual.data = final.data;
      atual.options = final.options ?? {};
      atual.update();
      return;
    }
    atual?.destroy();
    grafico.current = new Chart(canvas.current!, final);
    tipo.current = final.type;
  }, [config, reduzir]);

  useEffect(() => () => {
    grafico.current?.destroy();
    grafico.current = undefined;
  }, []);

  return (
    <pf-chart style={{ display: 'block' }}>
      <div style={{ position: 'relative', width: '100%', height: altura }}>
        <canvas ref={canvas} aria-label={rotulo} role="img" />
      </div>
    </pf-chart>
  );
}
