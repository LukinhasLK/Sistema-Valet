import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AvisoService } from '../../core/services/aviso.service';
import { baixarArquivo } from '../../core/services/download';
import { RelatoriosService } from '../../core/services/relatorios.service';
import { ChartConfiguration } from 'chart.js';
import { FichasService } from '../../core/services/fichas.service';
import { LayoutService } from '../../core/services/layout.service';
import { MESES, MESES_CURTOS, TODAS_UNIDADES } from '../../core/services/periodo';
import { UnidadesService } from '../../core/services/unidades.service';
import { ChartComponent } from '../../shared/charts/chart.component';
import { AZUL, escalasPadrao, formatarNumero, opcoesBase } from '../../shared/charts/chart-theme';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import { NumeroBrPipe } from '../../shared/pipes/numero-br.pipe';

@Component({
  selector: 'pf-carros-por-mes',
  standalone: true,
  imports: [RouterLink, FormsModule, PageHeaderComponent, KpiCardComponent, ChartComponent, CurrencyBrPipe, NumeroBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carros-por-mes.component.html',
  styleUrl: './carros-por-mes.component.scss',
})
export class CarrosPorMesComponent {
  private readonly relatorios = inject(RelatoriosService);
  private readonly aviso = inject(AvisoService);
  protected readonly exportando = signal<'pdf' | 'excel' | null>(null);
  private readonly fichasService = inject(FichasService);
  private readonly unidadesService = inject(UnidadesService);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly unidades = this.unidadesService.unidades;
  protected readonly todas = TODAS_UNIDADES;

  protected readonly mes = signal(0);
  protected readonly ano = signal(this.fichasService.periodoReferencia().ano);
  protected readonly unidadeId = signal(TODAS_UNIDADES);

  private readonly consulta = computed(() => ({ ano: this.ano(), unidadeId: this.unidadeId() }));

  protected readonly anoConsultado = computed(() => this.consulta().ano);

  private readonly resumoAnual = computed(() =>
    this.fichasService.resumoMensal(this.consulta().ano, this.consulta().unidadeId)
  );

  /** Só os meses que tiveram movimento entram na tabela e nas médias. */
  protected readonly mesesComDados = computed(() => this.resumoAnual().filter((m) => m.fichas > 0 && (!this.mes() || m.mes === this.mes())));

  protected readonly totalCarros = computed(() =>
    this.mesesComDados().reduce((soma, m) => soma + m.carros, 0)
  );

  protected readonly melhorMes = computed(() => {
    const comDados = this.mesesComDados();
    if (!comDados.length) return null;

    return comDados.reduce((melhor, atual) => (atual.carros > melhor.carros ? atual : melhor));
  });

  protected readonly mediaMensal = computed(() => {
    const comDados = this.mesesComDados();
    return comDados.length ? Math.round(this.totalCarros() / comDados.length) : 0;
  });

  /** Variação sobre os mesmos meses do ano anterior (ex.: jan–jun × jan–jun). */
  protected readonly comparativo = computed(() => {
    const meses = new Set(this.mesesComDados().map((m) => m.mes));
    const base = this.fichasService
      .resumoMensal(this.consulta().ano - 1, this.consulta().unidadeId)
      .filter((m) => meses.has(m.mes))
      .reduce((soma, m) => soma + m.carros, 0);

    if (!base) return null;

    const variacao = Math.round(((this.totalCarros() - base) / base) * 100);
    return { variacao, base, meses: meses.size };
  });

  protected readonly grafico = computed<ChartConfiguration>(() => {
    const meses = this.resumoAnual();
    const maior = Math.max(...meses.map((m) => m.carros));

    return {
      type: 'bar',
      data: {
        labels: MESES_CURTOS.map((m) => m),
        datasets: [
          {
            label: 'Carros',
            data: meses.map((m) => m.carros),
            // Passo escuro só no mês recorde; meses sem dados ficam bem claros.
            backgroundColor: meses.map((m) =>
              m.carros === 0 ? AZUL.claro : m.carros === maior ? AZUL.escuro : AZUL.medio
            ),
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao(formatarNumero),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: {
            ...opcoesBase().plugins!.tooltip,
            callbacks: {
              label: (item) => `${formatarNumero(item.parsed.y ?? 0)} carros`,
            },
          },
        },
      },
    };
  });

  protected async exportar(formato: 'pdf' | 'excel'): Promise<void> {
    if (this.exportando()) return;
    const { ano, unidadeId } = this.consulta();
    const mes = this.mes();
    this.exportando.set(formato);
    try {
      const arquivo = await firstValueFrom(this.relatorios.carros({
        ano, ...(mes ? { mes } : {}), ...(unidadeId === TODAS_UNIDADES ? {} : { unidadeId }),
      }, formato));
      baixarArquivo(arquivo, `parkflash-carros-${ano}-${String(mes || 1).padStart(2, '0')}-01.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.exportando.set(null);
    }
  }

  protected nomeMes(mes: number): string {
    return MESES[mes - 1];
  }
}
