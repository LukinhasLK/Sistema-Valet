import { paginar, PaginacaoComponent } from '../../shared/components/paginacao/paginacao';
import { DatePipe } from '@angular/common';
import { CalendarioComponent } from '../../shared/components/calendario/calendario.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CATEGORIAS_DESPESA, CategoriaDespesa, Despesa, HistoricoDespesa } from '../../core/models';
import { CLASSE_CATEGORIA, DespesasService, TODAS_CATEGORIAS } from '../../core/services/despesas.service';
import { LayoutService } from '../../core/services/layout.service';
import { FichasService } from '../../core/services/fichas.service';
import { hojeIso, MESES, TODAS_UNIDADES } from '../../core/services/periodo';
import { UnidadesService } from '../../core/services/unidades.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../shared/pipes/currency-br.pipe';
import { DataBrPipe } from '../../shared/pipes/data-br.pipe';
import { AvisoService } from '../../core/services/aviso.service';

@Component({
  selector: 'pf-despesas',
  standalone: true,
  imports: [PaginacaoComponent, DatePipe, CalendarioComponent,
    FormsModule, ReactiveFormsModule, PageHeaderComponent, IconComponent,
    ModalComponent, CurrencyBrPipe, DataBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './despesas.component.html',
  styleUrl: './despesas.component.scss',
})
export class DespesasComponent {
  private readonly despesasService = inject(DespesasService);
  private readonly aviso = inject(AvisoService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly fichasService = inject(FichasService);
  private readonly fb = inject(FormBuilder);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly meses = MESES;
  protected readonly anos = this.fichasService.anosDisponiveis;
  protected readonly categorias = CATEGORIAS_DESPESA;
  protected readonly todas = TODAS_UNIDADES;
  protected readonly todasCategorias = TODAS_CATEGORIAS;
  protected readonly unidades = this.unidadesService.unidades;

  protected readonly mes = signal(this.fichasService.periodoReferencia().mes);
  protected readonly ano = signal(this.fichasService.periodoReferencia().ano);
  protected readonly unidadeId = signal(TODAS_UNIDADES);
  protected readonly categoria = signal<string>(TODAS_CATEGORIAS);

  protected readonly verCanceladas = signal(false);

  protected readonly despesas = computed(() =>
    this.despesasService.filtrar({
      mes: this.mes(),
      ano: this.ano(),
      unidadeId: this.unidadeId(),
      categoria: this.categoria(),
      canceladas: this.verCanceladas(),
    })
  );
  protected readonly paginacao = paginar(this.despesas);

  protected readonly total = computed(() => this.despesasService.total(this.despesas()));

  protected readonly formAberto = signal(false);
  protected readonly emEdicao = signal<Despesa | null>(null);
  protected readonly unidadesParaLancamento = computed(() =>
    this.unidades().filter((u) => u.ativa !== false || u.id === this.emEdicao()?.unidadeId)
  );
  protected readonly paraCancelar = signal<Despesa | null>(null);
  protected readonly motivoCancelamento = signal('');
  protected readonly cancelando = signal(false);
  protected readonly carregandoHistorico = signal(false);
  protected readonly historico = signal<HistoricoDespesa[] | null>(null);
  protected readonly rotuloHistorico: Record<string, string> = {
    CRIAR: 'Registrou', ANTES_EDICAO: 'Versão anterior à edição', EDITAR: 'Editou', CANCELAR: 'Cancelou',
  };
  protected readonly detalhe = signal<Despesa | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    data: [hojeIso(), Validators.required],
    unidadeId: [null as number | null, Validators.required],
    categoria: ['Outros' as CategoriaDespesa, Validators.required],
    descricao: ['', Validators.required],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  protected classe(categoria: CategoriaDespesa): string {
    return CLASSE_CATEGORIA[categoria];
  }

  protected nomeUnidade(id: number): string {
    return this.unidadesService.nome(id);
  }

  protected abrirForm(despesa?: Despesa): void {
    this.emEdicao.set(despesa ?? null);
    this.form.reset(
      despesa
        ? { data: despesa.data, unidadeId: despesa.unidadeId, categoria: despesa.categoria, descricao: despesa.descricao, valor: despesa.valor }
        : {
            data: hojeIso(),
            unidadeId: this.unidadesParaLancamento().some((u) => u.id === this.unidadeId()) ? this.unidadeId() : null,
            categoria: 'Outros',
            descricao: '',
            valor: null,
          }
    );
    this.detalhe.set(null);
    this.formAberto.set(true);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const dados = { ...v, unidadeId: v.unidadeId!, valor: Number(v.valor) };
    const editada = this.emEdicao();
    try {
      if (editada) {
        await this.despesasService.atualizar({ ...dados, id: editada.id });
      } else {
        await this.despesasService.adicionar(dados);
      }
      this.formAberto.set(false);
      this.aviso.sucesso('Despesa salva.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected abrirDetalhe(despesa: Despesa | null): void {
    this.detalhe.set(despesa);
    this.historico.set(null);
  }

  protected abrirCancelamento(despesa: Despesa): void {
    this.detalhe.set(null);
    this.motivoCancelamento.set('');
    this.paraCancelar.set(despesa);
  }

  protected async consultarHistorico(despesa: Despesa): Promise<void> {
    if (this.carregandoHistorico()) return;
    this.carregandoHistorico.set(true);
    try {
      const registros = await this.despesasService.historico(despesa.id);
      if (this.detalhe() === despesa) this.historico.set(registros);
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.carregandoHistorico.set(false);
    }
  }

  protected async confirmarCancelamento(): Promise<void> {
    const despesa = this.paraCancelar();
    const motivo = this.motivoCancelamento().trim();
    if (!despesa || !motivo || this.cancelando()) return;
    this.cancelando.set(true);
    try {
      await this.despesasService.cancelar(despesa.id, motivo);
      this.paraCancelar.set(null);
      this.aviso.sucesso('Despesa cancelada. O registro permanece no histórico.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.cancelando.set(false);
    }
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
