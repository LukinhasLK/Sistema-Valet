import { ChartOptions, TooltipOptions } from 'chart.js';

/**
 * Paleta categórica validada para daltonismo (deutan/protan/tritan).
 * Os três primeiros slots passam em todos os pares — é o limite de séries
 * que um gráfico categórico deste app deve exibir.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const;

/** Hue sequencial única, do claro ao escuro. */
export const AZUL = {
  claro: '#9ec5f4',
  medio: '#2a78d6',
  escuro: '#184f95',
} as const;

export const SUPERFICIE = '#ffffff';
export const GRADE = '#e5e7eb';
export const TEXTO_EIXO = '#6b7280';
export const FONTE = "'Inter', system-ui, sans-serif";

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMERO = new Intl.NumberFormat('pt-BR');

export const formatarMoeda = (v: number) => MOEDA.format(v);
export const formatarNumero = (v: number) => NUMERO.format(v);

/** Tooltip com a mesma linguagem visual dos cards. */
export const TOOLTIP: Partial<TooltipOptions> = {
  backgroundColor: '#111827',
  titleFont: { family: FONTE, size: 12, weight: 600 },
  bodyFont: { family: FONTE, size: 13, weight: 500 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  borderColor: 'rgba(255,255,255,.12)',
  borderWidth: 1,
};

/** Base comum: sem legenda nativa (usamos legendas em HTML) e responsivo. */
export function opcoesBase(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: TOOLTIP,
    },
  };
}

/** Eixos discretos: grade horizontal suave, sem bordas nem grade vertical. */
export function escalasPadrao(formatador: (v: number) => string): ChartOptions['scales'] {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: TEXTO_EIXO, font: { family: FONTE, size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: GRADE },
      border: { display: false },
      ticks: {
        color: TEXTO_EIXO,
        font: { family: FONTE, size: 11 },
        maxTicksLimit: 6,
        callback: (valor) => formatador(Number(valor)),
      },
    },
  };
}
