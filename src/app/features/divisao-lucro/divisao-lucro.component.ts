import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';
import { round2 } from '../../core/services/calc';
import { DivisaoLucro, RelatoriosService } from '../../core/services/relatorios.service';
import { mensagemDeErro } from '../../core/services/api';
import { FichasService } from '../../core/services/fichas.service';
import { LayoutService } from '../../core/services/layout.service';
import { MESES, rotuloPeriodo } from '../../core/services/periodo';
import { SociosService } from '../../core/services/socios.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { ChartComponent } from '../../shared/charts/chart.component';
import { formatarMoeda, SERIES, SUPERFICIE, TOOLTIP } from '../../shared/charts/chart-theme';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';

/** Cinza reservado para o agrupamento "Outros" (nunca um slot categórico). */
const NEUTRO = '#9ca3af';

interface RetornoRateio {
  dados?: DivisaoLucro;
  erro?: string;
  filtro?: { mes: number; ano: number; unidadeId: number };
}

interface FatiaSocio {
  nome: string;
  percentual: number;
  valor: number;
  cor: string;
}

@Component({
  selector: 'pf-divisao-lucro',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KpiCardComponent, ChartComponent, CurrencyBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './divisao-lucro.component.html',
  styleUrl: './divisao-lucro.component.scss',
})
export class DivisaoLucroComponent {
  private readonly fichasService = inject(FichasService);
  private readonly sociosService = inject(SociosService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly relatorios = inject(RelatoriosService);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly unidades = this.unidadesService.unidades;

  protected readonly mes = signal(this.fichasService.periodoReferencia().mes);
  protected readonly ano = signal(this.fichasService.periodoReferencia().ano);
  protected readonly unidadeId = signal(this.unidadePadrao());

  private readonly consulta = computed(() => ({ mes: this.mes(), ano: this.ano(), unidadeId: this.unidadeId() }));
  private readonly resultadoApi = toSignal(toObservable(this.consulta).pipe(
    switchMap((filtro) => !filtro.unidadeId ? of<RetornoRateio>({}) : this.relatorios.divisao(filtro).pipe(
      map((dados): RetornoRateio => ({ dados, filtro })),
      catchError((e: unknown) => of<RetornoRateio>({ erro: mensagemDeErro(e), filtro })),
      startWith<RetornoRateio>({}),
    )),
  ), { initialValue: {} as RetornoRateio });
  protected readonly erro = computed(() => this.resultadoApi().filtro === this.consulta() ? this.resultadoApi().erro : null);
  protected readonly rateio = computed(() => this.resultadoApi().filtro === this.consulta() ? this.resultadoApi().dados : null);

  protected readonly periodoLabel = computed(() => rotuloPeriodo(this.mes(), this.ano()));
  protected readonly unidadeLabel = computed(() => this.unidadesService.nome(this.unidadeId()));

  protected readonly resultado = computed(() => this.rateio()?.resultado ?? 0);
  protected readonly partes = computed(() => this.rateio()?.partes ?? []);

  /**
   * Cores do donut. A paleta categórica validada cobre três séries em todos os
   * pares; a partir da quarta, o excedente vira uma fatia neutra "Outros" —
   * o detalhamento ao lado continua listando cada sócio nominalmente.
   */
  protected readonly fatias = computed<FatiaSocio[]>(() => {
    const partes = this.partes();

    if (partes.length <= SERIES.length) {
      return partes.map((parte, i) => ({ ...parte, cor: SERIES[i] }));
    }

    const principais = partes.slice(0, SERIES.length - 1).map((parte, i) => ({ ...parte, cor: SERIES[i] }));
    const restante = partes.slice(SERIES.length - 1);

    return [
      ...principais,
      {
        nome: `Outros (${restante.length})`,
        percentual: round2(restante.reduce((soma, p) => soma + p.percentual, 0)),
        valor: round2(restante.reduce((soma, p) => soma + p.valor, 0)),
        cor: NEUTRO,
      },
    ];
  });

  protected readonly totalDistribuido = computed(() =>
    round2(this.partes().reduce((soma, parte) => soma + parte.valor, 0))
  );

  /** O donut representa proporção — com saldo negativo ele não faz sentido. */
  protected readonly saldoNegativo = computed(() => this.resultado() < 0);

  protected readonly grafico = computed<ChartConfiguration>(() => {
    const fatias = this.fatias();

    return {
      type: 'doughnut',
      data: {
        labels: fatias.map((f) => f.nome),
        datasets: [
          {
            data: fatias.map((f) => f.percentual),
            backgroundColor: fatias.map((f) => f.cor),
            // Anel de 2px na cor da superfície separando as fatias.
            borderColor: SUPERFICIE,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP,
            callbacks: {
              label: (item) => {
                const fatia = fatias[item.dataIndex];
                return `${fatia.percentual.toFixed(1)}% · ${formatarMoeda(fatia.valor)}`;
              },
            },
          },
        },
      },
    };
  });

  /**
   * Cor da barra de cada sócio no detalhamento. A lista nomeia todos os
   * sócios, inclusive os que o donut agrupa em "Outros" — esses recebem o
   * neutro, nunca um slot categórico.
   */
  protected corDoSocio(indice: number): string {
    return indice < SERIES.length && this.partes().length <= SERIES.length
      ? SERIES[indice]
      : indice < SERIES.length - 1
        ? SERIES[indice]
        : NEUTRO;
  }

  /** Largura da barra do detalhamento, proporcional ao maior percentual. */
  protected largura(percentual: number): number {
    const maior = Math.max(...this.partes().map((p) => p.percentual), 1);
    return Math.round((percentual / maior) * 100);
  }

  private unidadePadrao(): number {
    return this.sociosService.unidadesConfiguradas()[0]?.unidadeId ?? this.unidadesService.unidades()[0]?.id ?? 0;
  }
}
