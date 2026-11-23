import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { mensagemDeErro } from '../../core/services/api';
import { AvisoService } from '../../core/services/aviso.service';
import { baixarArquivo } from '../../core/services/download';
import { FichasService } from '../../core/services/fichas.service';
import { LayoutService } from '../../core/services/layout.service';
import { MESES, rotuloPeriodo, TODAS_UNIDADES } from '../../core/services/periodo';
import { FiltroRelatorio, RelatorioFinanceiro, RelatoriosService } from '../../core/services/relatorios.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import { DataBrPipe } from '../../shared/pipes/data-br.pipe';

type Consulta =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronta'; filtro: FiltroRelatorio; tentativa: number; dados: RelatorioFinanceiro };

@Component({
  selector: 'pf-relatorios',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KpiCardComponent, IconComponent, CurrencyBrPipe, DataBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './relatorios.component.html',
  styleUrl: './relatorios.component.scss',
})
export class RelatoriosComponent {
  private readonly fichas = inject(FichasService);
  private readonly api = inject(RelatoriosService);
  private readonly aviso = inject(AvisoService);
  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly unidades = inject(UnidadesService).unidades;
  protected readonly meses = MESES;
  protected readonly anos = this.fichas.anosDisponiveis;
  protected readonly todas = TODAS_UNIDADES;
  protected readonly mes = signal(this.fichas.periodoReferencia().mes);
  protected readonly ano = signal(this.fichas.periodoReferencia().ano);
  protected readonly unidadeId = signal(TODAS_UNIDADES);
  protected readonly periodoLabel = computed(() => rotuloPeriodo(this.mes(), this.ano()));
  protected readonly exportando = signal<'pdf' | 'excel' | null>(null);
  private readonly tentativa = signal(0);
  private readonly conf = computed(() => {
    const mes = this.mes();
    const unidadeId = this.unidadeId();
    return {
      filtro: { ano: this.ano(), ...(mes ? { mes } : {}), ...(unidadeId !== TODAS_UNIDADES ? { unidadeId } : {}) },
      tentativa: this.tentativa(),
    };
  });

  private readonly resultado = toSignal(toObservable(this.conf).pipe(
    switchMap(({ filtro, tentativa }) => this.api.financeiro(filtro).pipe(
      map((dados): Consulta => ({ tipo: 'pronta', filtro, tentativa, dados })),
      catchError((erro: unknown) => of<Consulta>({ tipo: 'erro', mensagem: mensagemDeErro(erro) })),
      startWith<Consulta>({ tipo: 'carregando' }),
    )),
  ), { initialValue: { tipo: 'carregando' } as Consulta });

  protected readonly consulta = computed(() => {
    const resultado = this.resultado();
    const { filtro, tentativa } = this.conf();
    if (resultado.tipo === 'pronta' && (resultado.filtro !== filtro || resultado.tentativa !== tentativa)) {
      return { tipo: 'carregando' } as const;
    }
    return resultado;
  });

  protected tentarNovamente(): void {
    this.tentativa.update((n) => n + 1);
  }

  protected async exportar(formato: 'pdf' | 'excel'): Promise<void> {
    const consulta = this.consulta();
    if (consulta.tipo !== 'pronta' || this.exportando()) return;
    this.exportando.set(formato);
    try {
      const arquivo = await firstValueFrom(this.api[formato](consulta.filtro));
      const extensao = formato === 'pdf' ? 'pdf' : 'xlsx';
      baixarArquivo(arquivo, `parkflash-financeiro-${consulta.dados.inicio}.${extensao}`);
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.exportando.set(null);
    }
  }
}
