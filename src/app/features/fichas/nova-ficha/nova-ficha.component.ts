import { CalendarioComponent } from '../../../shared/components/calendario/calendario.component';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { Forma } from '../../../core/services/pagamentos-manobristas.service';
import type { TipoPix } from '../../../core/services/pagamentos-manobristas.service';
import { AvisoService } from '../../../core/services/aviso.service';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Ficha, Manobrista, ModalidadeCusto, MODALIDADES_CUSTO, Turno } from '../../../core/models';
import {
  calcLiquidoCartao,
  calcSaldoFinal,
  calcTaxaDescontada,
  calcTotalBruto,
  calcTotalCarros,
  calcTotalDespesas,
  calcTotalDiarias,
  dividirEntreSocios,
} from '../../../core/services/calc';
import { FichasService } from '../../../core/services/fichas.service';
import { LayoutService } from '../../../core/services/layout.service';
import { hojeIso } from '../../../core/services/periodo';
import { ManobristasService } from '../../../core/services/manobristas.service';
import { SociosService } from '../../../core/services/socios.service';
import { UnidadesService } from '../../../core/services/unidades.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyBrPipe } from '../../../shared/pipes/currency-br.pipe';
import { cpfValido, MascaraDirective, telefoneValido } from '../../../shared/directives/mascara.directive';

/** A numeração final precisa cobrir a inicial mais as fichas canceladas. */
function sequenciaValida(grupo: AbstractControl): ValidationErrors | null {
  const inicio = Number(grupo.get('fichaInicio')?.value ?? 0);
  const fim = Number(grupo.get('fichaFim')?.value ?? 0);
  const canceladas = Number(grupo.get('fichasCanceladas')?.value ?? 0);

  return fim - inicio - canceladas < 0 ? { sequenciaInvalida: true } : null;
}

/** O mesmo manobrista não pode aparecer duas vezes na equipe. */
function semManobristaRepetido(lista: AbstractControl): ValidationErrors | null {
  const ids = (lista.value as { manobristaId: number | null }[]).map((m) => m.manobristaId).filter((id) => id != null);
  return new Set(ids).size !== ids.length ? { manobristaRepetido: true } : null;
}

const ETAPAS = [
  { titulo: 'Identificação', subtitulo: 'Onde e quando o serviço aconteceu' },
  { titulo: 'Controle de Carros', subtitulo: 'Numeração das fichas do dia' },
  { titulo: 'Equipe', subtitulo: 'Manobristas e custos' },
  { titulo: 'Recebimentos', subtitulo: 'Recebimentos e despesas do dia' },
  { titulo: 'Resumo Final', subtitulo: 'Confira antes de lançar' },
] as const;

@Component({
  selector: 'pf-nova-ficha',
  standalone: true,
  imports: [CalendarioComponent, ReactiveFormsModule, MascaraDirective, PageHeaderComponent, IconComponent, ModalComponent, CurrencyBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nova-ficha.component.html',
  styleUrl: './nova-ficha.component.scss',
})
export class NovaFichaComponent implements OnInit {
  /** Preenchido pela rota `fichas/:id/editar`. */
  readonly id = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly aviso = inject(AvisoService);
  private readonly fichasService = inject(FichasService);
  private readonly manobristasService = inject(ManobristasService);
  private readonly sociosService = inject(SociosService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  private readonly auth = inject(AuthService);
  protected readonly podeConfirmar = computed(() => ['Gerente', 'Proprietário'].includes(this.auth.nivel() ?? ''));
  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly etapas = ETAPAS;
  protected readonly unidades = computed(() =>
    this.unidadesService.unidades().filter((u) => u.ativa !== false || u.id === this.emEdicao()?.unidadeId)
  );
  protected readonly manobristasDisponiveis = this.manobristasService.manobristas;

  protected readonly etapa = signal(0);
  protected readonly novoManobristaAberto = signal(false);
  protected readonly enviado = signal(false);
  protected readonly emEdicao = signal<Ficha | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      unidadeId: [null as number | null, Validators.required],
      data: [hojeIso(), Validators.required],
      turno: ['dia' as Turno, Validators.required],
      fichaInicio: [null as number | null, [Validators.required, Validators.min(0)]],
      fichaFim: [null as number | null, [Validators.required, Validators.min(0)]],
      fichasCanceladas: [null as number | null, [Validators.min(0)]],
      manobristas: this.fb.array<FormGroup>([], { validators: semManobristaRepetido }),
      valorDinheiro: [null as number | null, [Validators.min(0)]],
      valorInicialCaixa: [null as number | null, [Validators.min(0), Validators.max(9999999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      valorFinalCaixa: [null as number | null, [Validators.min(0), Validators.max(9999999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      observacoes: ['', Validators.maxLength(500)],
      valorCartao: [null as number | null, [Validators.min(0)]],
      valorPix: [null as number | null, [Validators.min(0), Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      taxaMaquininha: [2, [Validators.required, Validators.min(0), Validators.max(100)]],
      despesasAdicionais: this.fb.array<FormGroup>([]),
    },
    { validators: sequenciaValida }
  );

  /** Espelho reativo do formulário — alimenta todos os cálculos em tela. */
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly novoManobristaForm = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    telefone: ['', telefoneValido],
    cpf: ['', cpfValido],
    tipoPix: ['CPF' as TipoPix],
    chavePix: [''],
  });

  constructor() {
    this.adicionarManobrista();
  }

  ngOnInit(): void {
    const ficha = this.fichasService.fichas().find((f) => f.id === Number(this.id()));
    if (this.id() && !ficha) {
      this.router.navigate(['/app/fichas']);
      return;
    }
    if (ficha?.situacao && ficha.situacao !== 'EM_EDICAO') {
      this.aviso.erro(null, 'A ficha precisa voltar para edição antes de ser alterada.');
      void this.router.navigate(['/app/fichas']);
      return;
    }
    if (ficha) this.carregar(ficha);
  }

  private carregar(ficha: Ficha): void {
    this.emEdicao.set(ficha);
    this.manobristas.clear();
    ficha.manobristas.forEach((m) => this.adicionarManobrista(m.manobristaId, m.diaria, m.modalidade));
    this.despesas.clear();
    ficha.despesasAdicionais.forEach((d) => this.adicionarDespesa(d.descricao, d.valor));
    this.form.patchValue({
      unidadeId: ficha.unidadeId,
      data: ficha.data,
      turno: ficha.turno,
      fichaInicio: ficha.fichaInicio,
      fichaFim: ficha.fichaFim,
      fichasCanceladas: ficha.fichasCanceladas,
      valorDinheiro: ficha.valorDinheiro,
      valorCartao: ficha.valorCartao,
      valorPix: ficha.valorPix ?? null,
      valorInicialCaixa: ficha.valorInicialCaixa ?? null,
      valorFinalCaixa: ficha.valorFinalCaixa ?? null,
      observacoes: ficha.observacoes ?? '',
      taxaMaquininha: ficha.taxaMaquininha,
    });
  }

  /* --------------------------------------------------------------------- */
  /* Arrays dinâmicos                                                       */
  /* --------------------------------------------------------------------- */

  get manobristas(): FormArray<FormGroup> {
    return this.form.controls.manobristas;
  }

  get despesas(): FormArray<FormGroup> {
    return this.form.controls.despesasAdicionais;
  }

  protected readonly modalidades = Object.entries(MODALIDADES_CUSTO);

  protected adicionarManobrista(manobristaId: number | null = null, diaria = 80,
                                modalidade: ModalidadeCusto = 'DIARIA_FIXA'): void {
    this.manobristas.push(
      this.fb.nonNullable.group({
        manobristaId: [manobristaId, Validators.required],
        pagamento: [this.emEdicao() ? 'CONFERIR' : ''],
        modalidade: [modalidade, Validators.required],
        diaria: [diaria, [Validators.required, Validators.min(0)]],
      }, { validators: (linha: AbstractControl) =>
        linha.value.diaria > 0 && !linha.value.pagamento ? { pagamentoObrigatorio: true } : null })
    );
  }

  /** Esconde da lista quem já foi escolhido em outra linha. */
  protected opcoesManobrista(indice: number) {
    const escolhidos = new Set(
      (this.valores().manobristas ?? []).filter((_, i) => i !== indice).map((m) => m?.['manobristaId'])
    );
    return this.manobristasDisponiveis().filter((m) => !escolhidos.has(m.id)
      && (m.ativo !== false || this.emEdicao()?.manobristas.some((linha) => linha.manobristaId === m.id)));
  }

  protected removerManobrista(indice: number): void {
    this.manobristas.removeAt(indice);
  }

  protected adicionarDespesa(descricao = '', valor: number | null = null): void {
    this.despesas.push(
      this.fb.nonNullable.group({
        descricao: [descricao, Validators.required],
        valor: [valor, [Validators.required, Validators.min(0)]],
      })
    );
  }

  protected removerDespesa(indice: number): void {
    this.despesas.removeAt(indice);
  }

  protected async salvarNovoManobrista(): Promise<void> {
    if (this.novoManobristaForm.invalid) {
      this.novoManobristaForm.markAllAsTouched();
      return;
    }

    let criado: Manobrista;
    try {
      const { tipoPix, chavePix, ...cadastro } = this.novoManobristaForm.getRawValue();
      criado = await this.manobristasService.salvarManobrista({
        ...cadastro, pix: this.podeCadastrarPix() && chavePix.trim() ? { tipo: tipoPix, chave: chavePix.trim() } : undefined,
      });
    } catch (erro) {
      this.aviso.erro(erro);
      return;
    }

    // Aproveita a primeira linha vazia da equipe, se houver.
    const vaga = this.manobristas.controls.find((grupo) => grupo.get('manobristaId')?.value == null);
    if (vaga) {
      vaga.get('manobristaId')?.setValue(criado.id);
    } else {
      this.adicionarManobrista(criado.id);
    }

    this.novoManobristaForm.reset({ nome: '', telefone: '', cpf: '' });
    this.novoManobristaAberto.set(false);
  }

  /* --------------------------------------------------------------------- */
  /* Cálculos                                                               */
  /* --------------------------------------------------------------------- */

  protected readonly totalCarros = computed(() => {
    const v = this.valores();
    return calcTotalCarros(Number(v.fichaInicio), Number(v.fichaFim), Number(v.fichasCanceladas));
  });

  protected readonly taxaDescontada = computed(() =>
    calcTaxaDescontada(Number(this.valores().valorCartao), Number(this.valores().taxaMaquininha))
  );

  protected readonly liquidoCartao = computed(() =>
    calcLiquidoCartao(Number(this.valores().valorCartao), Number(this.valores().taxaMaquininha))
  );

  /** Todas as linhas contam no total, mesmo antes de escolher o manobrista. */
  private readonly equipe = computed(() =>
    (this.valores().manobristas ?? []).map((m) => ({
      manobristaId: Number(m?.['manobristaId'] ?? 0),
      diaria: Number(m?.['diaria'] ?? 0),
      modalidade: m?.['modalidade'] as ModalidadeCusto,
      ...this.dadosPagamento(m?.['pagamento']),
    }))
  );

  private dadosPagamento(opcao: string): { pagaNaFicha?: boolean; formaPagamento?: Forma } {
    if (this.emEdicao() || !opcao || opcao === 'CONFERIR') return {};
    if (opcao === 'PENDENTE') return { pagaNaFicha: false };
    return { pagaNaFicha: true, formaPagamento: opcao as Forma };
  }

  private readonly despesasInformadas = computed(() =>
    (this.valores().despesasAdicionais ?? [])
      .map((d) => ({ descricao: String(d?.['descricao'] ?? ''), valor: Number(d?.['valor'] ?? 0) }))
      .filter((d) => d.descricao)
  );

  /** Já existe ficha para a mesma data, unidade e turno (avisa enquanto o usuário preenche). */
  protected readonly erroDuplicada = computed(() => {
    const v = this.valores();
    return (
      !!v.unidadeId &&
      !!v.data &&
      this.fichasService.existeDuplicada(
        { data: v.data, unidadeId: Number(v.unidadeId), turno: v.turno ?? 'dia' },
        this.emEdicao()?.id
      )
    );
  });

  protected readonly totalDiarias = computed(() => calcTotalDiarias(this.equipe()));
  protected readonly totalDespesas = computed(() => calcTotalDespesas(this.despesasInformadas()));

  protected readonly podeCadastrarPix = computed(() => this.auth.nivel() === 'Proprietário');

  protected readonly saldoFinal = computed(() =>
    calcSaldoFinal({
      valorDinheiro: Number(this.valores().valorDinheiro),
      valorCartao: Number(this.valores().valorCartao),
      valorPix: Number(this.valores().valorPix),
      taxaMaquininha: Number(this.valores().taxaMaquininha),
      manobristas: this.equipe(),
      despesasAdicionais: this.despesasInformadas(),
    })
  );

  protected readonly divisao = computed(() => {
    const unidadeId = Number(this.valores().unidadeId ?? 0);
    const unidade = this.sociosService.totaisPorUnidade().find((total) => total.unidadeId === unidadeId);
    const data = this.valores().data;
    return unidade?.valido && data?.slice(0, 7) === hojeIso().slice(0, 7)
      ? dividirEntreSocios(this.saldoFinal(), this.sociosService.socios(), unidade.unidadeId)
      : [];
  });

  /* --------------------------------------------------------------------- */
  /* Navegação do stepper                                                   */
  /* --------------------------------------------------------------------- */

  /** Controles que precisam estar válidos para sair de cada etapa. */
  private camposDaEtapa(indice: number): AbstractControl[] {
    const c = this.form.controls;
    switch (indice) {
      case 0: return [c.unidadeId, c.data, c.turno];
      case 1: return [c.fichaInicio, c.fichaFim, c.fichasCanceladas];
      case 2: return [c.manobristas];
      case 3: return [c.valorDinheiro, c.valorCartao, c.valorPix, c.valorInicialCaixa, c.valorFinalCaixa, c.observacoes, c.taxaMaquininha, c.despesasAdicionais];
      default: return [];
    }
  }

  protected etapaValida(indice: number): boolean {
    const camposOk = this.camposDaEtapa(indice).every((campo) => campo.valid);
    // A etapa de carros também depende do validador cruzado do formulário.
    return indice === 1 ? camposOk && !this.form.errors?.['sequenciaInvalida'] : camposOk;
  }

  protected avancar(): void {
    if (!this.etapaValida(this.etapa())) {
      this.camposDaEtapa(this.etapa()).forEach((campo) => campo.markAllAsTouched());
      return;
    }
    this.etapa.update((atual) => Math.min(atual + 1, ETAPAS.length - 1));
  }

  protected voltar(): void {
    this.etapa.update((atual) => Math.max(atual - 1, 0));
  }

  protected irPara(indice: number): void {
    if (indice <= this.etapa() || this.etapaValida(this.etapa())) this.etapa.set(indice);
  }

  /* --------------------------------------------------------------------- */
  /* Envio                                                                  */
  /* --------------------------------------------------------------------- */

  protected readonly podeLancar = computed(() => {
    this.valores(); // validade do form não é signal; recalcula a cada mudança de valor
    return [0, 1, 2, 3].every((etapa) => this.etapaValida(etapa));
  });

  protected readonly salvando = signal(false);

  protected async lancar(): Promise<void> {
    this.enviado.set(true);
    const v = this.form.getRawValue();
    const editada = this.emEdicao();

    if (this.form.invalid || this.erroDuplicada()) {
      this.form.markAllAsTouched();
      // Leva o usuário de volta à primeira etapa com pendência e rola até o erro.
      const pendente = this.erroDuplicada() ? 0 : [0, 1, 2, 3].find((etapa) => !this.etapaValida(etapa));
      if (pendente !== undefined) this.etapa.set(pendente);
      afterNextRender(() => this.rolarParaPrimeiroErro(), { injector: this.injector });
      return;
    }

    const dados: Omit<Ficha, 'id'> = {
      data: v.data,
      unidadeId: v.unidadeId!,
      turno: v.turno,
      fichaInicio: Number(v.fichaInicio),
      fichaFim: Number(v.fichaFim),
      fichasCanceladas: Number(v.fichasCanceladas),
      totalCarros: this.totalCarros(),
      valorDinheiro: Number(v.valorDinheiro),
      valorCartao: Number(v.valorCartao),
      valorPix: Number(v.valorPix),
      valorInicialCaixa: v.valorInicialCaixa,
      valorFinalCaixa: v.valorFinalCaixa,
      observacoes: v.observacoes,
      taxaMaquininha: Number(v.taxaMaquininha),
      manobristas: this.equipe(),
      despesasAdicionais: this.despesasInformadas(),
      totalBruto: calcTotalBruto(Number(v.valorDinheiro), Number(v.valorCartao), Number(v.valorPix)),
      totalLiquido: this.saldoFinal(),
    };

    this.salvando.set(true);
    try {
      if (editada) {
        await this.fichasService.atualizar({ ...dados, id: editada.id });
      } else {
        await this.fichasService.adicionar(dados);
      }
    } catch (erro) {
      this.aviso.erro(erro);
      return;
    } finally {
      this.salvando.set(false);
    }

    this.aviso.sucesso(editada ? 'Ficha atualizada.' : 'Ficha lançada.');
    void this.router.navigate(['/app/fichas']);
  }

  private rolarParaPrimeiroErro(): void {
    const erro = this.host.nativeElement.querySelector('.pf-error');
    const campo = erro?.closest('.pf-field, fieldset, section') ?? erro;
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    campo?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && (campo.touched || this.enviado());
  }

  protected get sequenciaInvalida(): boolean {
    return !!this.form.errors?.['sequenciaInvalida'] && (this.form.controls.fichaFim.touched || this.enviado());
  }
}
