import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { mensagemDeErro } from '../../core/services/api';
import { RelatoriosService, ResumoPainel } from '../../core/services/relatorios.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { ChartConfiguration } from 'chart.js';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FichasService } from '../../core/services/fichas.service';
import { LayoutService } from '../../core/services/layout.service';
import { podeAcessar } from '../../core/services/permissoes';
import { anoDe, hojeIso, mesDe, MESES, MESES_CURTOS, rotuloPeriodo, TODAS_UNIDADES } from '../../core/services/periodo';
import { carregar, salvar } from '../../core/services/storage';
import { SociosService } from '../../core/services/socios.service';
import { ChartComponent } from '../../shared/charts/chart.component';
import { AZUL, escalasPadrao, formatarMoeda, opcoesBase } from '../../shared/charts/chart-theme';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import { NumeroBrPipe } from '../../shared/pipes/numero-br.pipe';

interface Painel {
  carregando: boolean;
  dados?: ResumoPainel;
  erro?: string;
}

@Component({
  selector: 'pf-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, KpiCardComponent, ChartComponent, IconComponent, CurrencyBrPipe, NumeroBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly fichasService = inject(FichasService);
  private readonly relatorios = inject(RelatoriosService);
  protected readonly unidades = inject(UnidadesService).unidades;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly todas = TODAS_UNIDADES;
  protected readonly mes = signal(mesDe(hojeIso()));
  protected readonly ano = signal(anoDe(hojeIso()));
  protected readonly unidadeId = signal(TODAS_UNIDADES);
  protected readonly recarga = signal(0);
  private readonly sociosService = inject(SociosService);
  private readonly auth = inject(AuthService);
  private readonly chaveValores = `parkflash.painel.ocultar-valores.${this.auth.usuario()?.id}`;
  protected readonly valoresOcultos = signal(carregar(this.chaveValores, false));

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly primeiroNome = computed(() => this.auth.usuario()?.nome.split(' ')[0] ?? '');

  private readonly filtro = computed(() => ({ mes: this.mes(), ano: this.ano(), unidadeId: this.unidadeId() }));
  private readonly pedido = computed(() => {
    const { mes, ano, unidadeId } = this.filtro();
    this.recarga();
    return { mes, ano, ...(unidadeId === TODAS_UNIDADES ? {} : { unidadeId }) };
  });
  protected readonly painel = toSignal(toObservable(this.pedido).pipe(
    switchMap((filtro) => this.relatorios.painel(filtro).pipe(
      map((dados): Painel => ({ carregando: false, dados })),
      catchError((erro) => of<Painel>({ carregando: false, erro: mensagemDeErro(erro) })),
      startWith<Painel>({ carregando: true }),
    ))
  ), { initialValue: { carregando: true } as Painel });
  protected readonly periodoLegivel = computed(() => rotuloPeriodo(this.filtro().mes, this.filtro().ano));
  protected readonly periodo = computed(() => this.periodoLegivel().toUpperCase());

  private readonly fichasDoMes = computed(() => this.fichasService.filtrar(this.filtro()));
  protected readonly melhorDia = computed(() => this.fichasService.melhorDiaDaSemana(this.fichasDoMes()));

  protected readonly alertas = computed(() => {
    const alertas: { texto: string; rota: string }[] = [];
    const mes = MESES[this.filtro().mes - 1].toLowerCase();

    if (podeAcessar(this.auth.usuario()?.nivel, 'socios')) {
      for (const t of this.sociosService.totaisPorUnidade()) {
        if (!t.valido) {
          alertas.push({
            texto: t.vazia ? `${t.unidade} não tem sócios cadastrados` : `Rateio de ${t.unidade} soma ${t.total}% (precisa de 100%)`,
            rota: '/app/socios',
          });
        }
      }
    }

    const negativas = this.fichasDoMes().filter((f) => f.totalLiquido < 0).length;
    if (negativas > 0) {
      alertas.push({ texto: `${negativas} ficha(s) com líquido negativo em ${mes}`, rota: '/app/fichas' });
    }

    const painel = this.painel().dados;
    if (painel && painel.mes.resultado < 0) {
      alertas.push({ texto: `Resultado de ${mes} negativo após despesas fixas`, rota: '/app/despesas' });
    }

    if (painel?.fichasParaConferir) {
      alertas.push({ texto: `${painel.fichasParaConferir} ficha(s) para conferência`, rota: '/app/fichas' });
    }
    if (painel?.pagamentosPendentes) {
      alertas.push({ texto: 'Há diárias reconhecidas com saldo a pagar no recorte', rota: '/app/pagamentos-manobristas' });
    }
    if (painel?.eventosProximos) {
      alertas.push({ texto: `${painel.eventosProximos} evento(s) nos próximos 7 dias`, rota: '/app/eventos' });
    }
    return alertas;
  });

  protected readonly alertasAbertos = signal(false);

  protected alternarValores(): void {
    this.valoresOcultos.update((ocultos) => !ocultos);
    salvar(this.chaveValores, this.valoresOcultos());
  }

  protected tentarNovamente(): void {
    this.recarga.update((n) => n + 1);
  }

  /** Últimos nove dias com movimento no mês. */
  private readonly serieDiaria = computed(() => this.fichasService.liquidoPorDia(this.fichasDoMes(), 9));

  protected readonly graficoLinha = computed<ChartConfiguration>(() => {
    const pontos = this.serieDiaria();

    return {
      type: 'line',
      data: {
        labels: pontos.map((p) => p.rotulo),
        datasets: [
          {
            label: 'Valor líquido',
            data: pontos.map((p) => p.valor),
            borderColor: AZUL.medio,
            backgroundColor: 'rgba(42, 120, 214, .10)',
            borderWidth: 2,
            fill: true,
            cubicInterpolationMode: 'monotone',
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: AZUL.medio,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        ...opcoesBase(),
        scales: escalasPadrao((v) => formatarMoeda(v).replace(/\s?,00$/, '')),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: {
            ...opcoesBase().plugins!.tooltip,
            callbacks: {
              title: (itens) => `Dia ${itens[0].label}`,
              label: (item) => formatarMoeda(item.parsed.y ?? 0),
            },
          },
        },
      },
    };
  });

  protected readonly graficoBarras = computed<ChartConfiguration>(() => {
    const { mes, ano, unidadeId } = this.filtro();
    const meses = [
      ...this.fichasService.resumoMensal(ano - 1, unidadeId),
      ...this.fichasService.resumoMensal(ano, unidadeId),
    ].slice(12 + mes - 6, 12 + mes);

    const maior = Math.max(...meses.map((m) => m.liquido));

    return {
      type: 'bar',
      data: {
        labels: meses.map((m) => MESES_CURTOS[m.mes - 1]),
        datasets: [
          {
            label: 'Líquido',
            data: meses.map((m) => m.liquido),
            // Mesma hue; o mês recorde ganha o passo mais escuro.
            backgroundColor: meses.map((m) => (m.liquido === maior ? AZUL.escuro : AZUL.medio)),
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        ...opcoesBase(),
        interaction: { mode: 'nearest', intersect: true },
        scales: escalasPadrao((v) => formatarMoeda(v).replace(/\s?,00$/, '')),
        plugins: {
          ...opcoesBase().plugins,
          tooltip: {
            ...opcoesBase().plugins!.tooltip,
            callbacks: { label: (item) => formatarMoeda(item.parsed.y ?? 0) },
          },
        },
      },
    };
  });
}
