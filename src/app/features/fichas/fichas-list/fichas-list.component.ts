import { paginar, PaginacaoComponent } from '../../../shared/components/paginacao/paginacao';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, distinctUntilChanged, firstValueFrom, map, switchMap } from 'rxjs';
import { NotificacoesService } from '../../../core/services/notificacoes.service';
import { AcaoFicha, Ficha, MODALIDADES_CUSTO, RegistroFicha } from '../../../core/models';
import { AvisoService } from '../../../core/services/aviso.service';
import {
  calcLiquidoCartao,
  calcTaxaDescontada,
  calcTotalDespesas,
  calcTotalDiarias,
} from '../../../core/services/calc';
import { FichasService } from '../../../core/services/fichas.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/services/auth.service';
import { ManobristasService } from '../../../core/services/manobristas.service';
import { MESES, TODAS_UNIDADES } from '../../../core/services/periodo';
import { podeAcessar } from '../../../core/services/permissoes';
import { UnidadesService } from '../../../core/services/unidades.service';
import { ConfirmComponent } from '../../../shared/components/confirm/confirm.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../../shared/pipes/currency-br.pipe';
import { DataBrPipe } from '../../../shared/pipes/data-br.pipe';
import { NumeroBrPipe } from '../../../shared/pipes/numero-br.pipe';

@Component({
  selector: 'pf-fichas-list',
  standalone: true,
  imports: [PaginacaoComponent,
    DatePipe, FormsModule, RouterLink, PageHeaderComponent, KpiCardComponent, IconComponent,
    ModalComponent, ConfirmComponent, CurrencyBrPipe, DataBrPipe, NumeroBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fichas-list.component.html',
  styleUrl: './fichas-list.component.scss',
})
export class FichasListComponent {
  private readonly injector = inject(Injector);
  private readonly focoEtapa = viewChild<ElementRef<HTMLElement>>('focoEtapa');
  private readonly acoesDaFicha = viewChild<ElementRef<HTMLElement>>('acoesDaFicha');
  private readonly fichasService = inject(FichasService);
  private readonly aviso = inject(AvisoService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly manobristasService = inject(ManobristasService);
  private readonly auth = inject(AuthService);
  private readonly notificacoes = inject(NotificacoesService);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly todas = TODAS_UNIDADES;
  protected readonly unidades = this.unidadesService.unidades;
  protected readonly podeEditar = computed(() => podeAcessar(this.auth.nivel(), 'fichas/:id/editar'));

  protected readonly busca = signal('');
  protected readonly mes = signal(this.fichasService.periodoReferencia().mes);
  protected readonly ano = signal(this.fichasService.periodoReferencia().ano);
  protected readonly unidadeId = signal(TODAS_UNIDADES);
  protected readonly manobristas = this.manobristasService.manobristas;
  protected readonly manobristaId = signal<number | null>(null);

  protected readonly fichas = computed(() => {
    const id = this.manobristaId();
    return this.fichasService.filtrar(
      { mes: this.mes(), ano: this.ano(), unidadeId: this.unidadeId(), busca: this.busca() },
      (unidadeId) => this.unidadesService.nome(unidadeId)
    ).filter((ficha) => id === null || ficha.manobristas.some((linha) => linha.manobristaId === id));
  });
  protected readonly paginacao = paginar(this.fichas);

  protected readonly custoManobrista = computed(() => {
    const id = this.manobristaId();
    return calcTotalDiarias(this.fichas().flatMap((ficha) =>
      ficha.manobristas.filter((linha) => linha.manobristaId === id)));
  });

  protected nomeUnidade(id: number): string {
    return this.unidadesService.nome(id);
  }

  protected nomeManobrista(id: number): string {
    return this.manobristasService.nome(id);
  }

  protected readonly resumo = computed(() => this.fichasService.resumir(this.fichas()));

  protected readonly detalhe = signal<Ficha | null>(null);
  protected readonly paraExcluir = signal<Ficha | null>(null);
  protected readonly acao = signal<AcaoFicha | null>(null);
  protected readonly justificativa = signal('');
  protected readonly indicandoDivergencia = signal(false);
  protected readonly alterando = signal(false);
  protected readonly consultandoHistorico = signal(false);
  protected readonly historico = signal<RegistroFicha[] | null>(null);
  protected readonly modalidades = MODALIDADES_CUSTO;
  protected readonly rotulos = {
    ENVIAR: 'Enviar para conferência', FECHAR: 'Confirmar fechamento',
    DEVOLVER: 'Devolver para edição', REABRIR: 'Reabrir ficha',
  };
  protected readonly eventos: Record<string, string> = {
    CRIAR: 'Registrou a ficha', ALTERAR: 'Alterou a ficha', CANCELAR: 'Cancelou a ficha',
    ENVIAR: 'Enviou para conferência', FECHAR: 'Fechou a ficha',
    DEVOLVER: 'Devolveu para edição', REABRIR: 'Reabriu a ficha', DIVERGENCIA: 'Sinalizou divergência financeira',
  };

  constructor() {
    const parametros = inject(ActivatedRoute).snapshot.queryParamMap;
    const idManobrista = Number(parametros.get('manobristaId'));
    if (Number.isSafeInteger(idManobrista) && idManobrista > 0) this.manobristaId.set(idManobrista);
    const mes = parametros.has('mes') ? Number(parametros.get('mes')) : this.mes();
    const ano = Number(parametros.get('ano'));
    const unidadeId = Number(parametros.get('unidadeId'));
    if (Number.isInteger(mes) && mes >= 0 && mes <= 12) this.mes.set(mes);
    if (this.anos().includes(ano)) this.ano.set(ano);
    if (this.unidades().some((unidade) => unidade.id === unidadeId)) this.unidadeId.set(unidadeId);
    inject(ActivatedRoute).queryParamMap.pipe(
      map((p) => Number(p.get('detalhe'))),
      distinctUntilChanged(),
      switchMap((id) => Number.isSafeInteger(id) && id > 0 ? this.fichasService.detalhe(id).pipe(
        catchError((erro) => { this.aviso.erro(erro); return EMPTY; }),
      ) : EMPTY),
      takeUntilDestroyed(),
    ).subscribe((ficha) => this.abrirDetalhe(ficha));
  }

  protected prepararAcao(etapa: AcaoFicha | 'DIVERGENCIA' | null): void {
    this.acao.set(etapa === 'DIVERGENCIA' ? null : etapa);
    this.indicandoDivergencia.set(etapa === 'DIVERGENCIA');
    this.justificativa.set('');
    this.focarEtapa();
  }

  private focarEtapa(): void {
    afterNextRender(() => {
      const alvo = this.focoEtapa()?.nativeElement ?? this.acoesDaFicha()?.nativeElement;
      alvo?.focus();
    }, { injector: this.injector });
  }

  protected async sinalizarDivergencia(): Promise<void> {
    const ficha = this.detalhe();
    const motivo = this.justificativa().trim();
    if (!ficha || !motivo || this.alterando()) return;
    this.alterando.set(true);
    try {
      await firstValueFrom(this.notificacoes.divergencia(ficha.id, motivo));
      this.prepararAcao(null);
      this.historico.set(null);
      this.notificacoes.atualizarContador();
      this.aviso.sucesso('Divergência sinalizada.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.alterando.set(false);
    }
  }

  protected situacao(ficha: Ficha): string {
    switch (ficha.situacao) {
      case 'FECHADA': return 'Fechada';
      case 'PRONTA': return 'Pronta para conferência';
      case 'CANCELADA': return 'Cancelada';
      default: return 'Em edição';
    }
  }

  protected emEdicao(ficha: Ficha): boolean {
    return !ficha.situacao || ficha.situacao === 'EM_EDICAO';
  }

  protected abrirDetalhe(ficha: Ficha | null): void {
    this.detalhe.set(ficha);
    this.acao.set(null);
    this.indicandoDivergencia.set(false);
    this.justificativa.set('');
    this.historico.set(null);
  }

  protected async registrarTransicao(): Promise<void> {
    const ficha = this.detalhe();
    const acao = this.acao();
    if (!ficha || !acao || this.alterando()) return;
    this.alterando.set(true);
    try {
      const atual = await this.fichasService.transicao(ficha.id, acao, this.justificativa().trim() || undefined);
      if (this.detalhe()?.id === ficha.id) {
        this.abrirDetalhe(atual);
        this.focarEtapa();
      }
      this.aviso.sucesso('Situação da ficha atualizada.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.alterando.set(false);
    }
  }

  protected async consultarHistorico(): Promise<void> {
    const ficha = this.detalhe();
    if (!ficha || this.consultandoHistorico()) return;
    this.consultandoHistorico.set(true);
    try {
      const historico = await this.fichasService.historico(ficha.id);
      if (this.detalhe() === ficha) this.historico.set(historico);
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.consultandoHistorico.set(false);
    }
  }

  /** Quebra do saldo usada no modal de detalhe. */
  protected readonly detalheCalculos = computed(() => {
    const ficha = this.detalhe();
    if (!ficha) return null;

    return {
      taxaDescontada: calcTaxaDescontada(ficha.valorCartao, ficha.taxaMaquininha),
      liquidoCartao: calcLiquidoCartao(ficha.valorCartao, ficha.taxaMaquininha),
      totalDiarias: calcTotalDiarias(ficha.manobristas),
      totalDespesas: calcTotalDespesas(ficha.despesasAdicionais),
    };
  });

  protected async confirmarExclusao(): Promise<void> {
    const ficha = this.paraExcluir();
    this.paraExcluir.set(null);
    if (!ficha) return;
    try {
      await this.fichasService.excluir(ficha.id);
      this.aviso.sucesso('Ficha cancelada.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.mes.set(this.fichasService.periodoReferencia().mes);
    this.ano.set(this.fichasService.periodoReferencia().ano);
    this.unidadeId.set(TODAS_UNIDADES);
    this.manobristaId.set(null);
  }
}
