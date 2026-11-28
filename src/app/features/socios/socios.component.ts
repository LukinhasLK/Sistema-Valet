import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Socio, Unidade } from '../../core/models';
import { LayoutService } from '../../core/services/layout.service';
import { RevisaoRateio, SociosService } from '../../core/services/socios.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { ConfirmComponent } from '../../shared/components/confirm/confirm.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { hojeIso } from '../../core/services/periodo';
import { AvisoService } from '../../core/services/aviso.service';

@Component({
  selector: 'pf-socios',
  standalone: true,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, PageHeaderComponent, IconComponent, ModalComponent, ConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './socios.component.html',
  styleUrl: './socios.component.scss',
})
export class SociosComponent {
  private readonly sociosService = inject(SociosService);
  private readonly aviso = inject(AvisoService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly fb = inject(FormBuilder);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly socios = this.sociosService.socios;
  protected readonly unidades = this.unidadesService.unidades;
  protected readonly totais = this.sociosService.totaisPorUnidade;

  protected readonly formAberto = signal(false);
  protected readonly editando = signal<Socio | null>(null);
  protected readonly paraExcluir = signal<Socio | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
  });

  protected readonly mesAtual = hojeIso().slice(0, 7);
  protected readonly rateando = signal<Unidade | null>(null);
  protected readonly vigencia = signal(this.mesAtual);
  protected readonly cotas = signal<Partial<Record<number, number>>>({});
  protected readonly revisoes = signal<RevisaoRateio[]>([]);
  protected readonly carregandoRateio = signal(false);
  protected readonly erroRateio = signal(false);
  protected readonly salvandoRateio = signal(false);
  protected readonly somaRateio = computed(() =>
    Object.values(this.cotas()).reduce<number>((total, pct) => total + Math.round((pct ?? 0) * 100), 0) / 100
  );

  protected alterarCota(socioId: number, valor: number | null): void {
    this.cotas.update((cotas) => ({ ...cotas, [socioId]: valor ?? 0 }));
  }

  protected async abrirRateio(unidade: Unidade): Promise<void> {
    this.rateando.set(unidade);
    this.vigencia.set(this.mesAtual);
    this.cotas.set({});
    this.revisoes.set([]);
    this.carregandoRateio.set(true);
    this.erroRateio.set(false);
    try {
      const [cotas, revisoes] = await Promise.all([
        this.sociosService.listarCotas(unidade.id, hojeIso()),
        this.sociosService.historicoRateio(unidade.id),
      ]);
      if (this.rateando()?.id !== unidade.id) return;
      this.cotas.set(Object.fromEntries(cotas.map((c) => [c.socioId, c.percentual])));
      this.revisoes.set(revisoes);
    } catch (erro) {
      this.erroRateio.set(true);
      this.aviso.erro(erro);
    } finally {
      this.carregandoRateio.set(false);
    }
  }

  protected async salvarRateio(): Promise<void> {
    const unidade = this.rateando();
    const vigencia = this.vigencia();
    if (!unidade || !vigencia || this.salvandoRateio() || this.somaRateio() !== 100) return;
    const partes = this.socios().map((socio) => ({ socioId: socio.id, percentual: this.cotas()[socio.id] ?? 0 }))
      .filter((parte) => parte.percentual > 0);
    this.salvandoRateio.set(true);
    try {
      await this.sociosService.configurarRateio(unidade.id, `${vigencia}-01`, partes);
      this.rateando.set(null);
      this.aviso.sucesso('Rateio registrado para o mês selecionado.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.salvandoRateio.set(false);
    }
  }

  protected percentual(socio: Socio, unidadeId: number): number | null {
    return this.sociosService.percentual(socio, unidadeId);
  }

  protected nomeUnidade(id: number): string {
    return this.unidadesService.nome(id);
  }

  protected participacoes(socio: Socio) {
    return socio.percentuais.filter((p) => p.percentual > 0);
  }

  protected abrir(socio?: Socio): void {
    this.editando.set(socio ?? null);

    this.form.controls.nome.setValue(socio?.nome ?? '');
    this.form.markAsUntouched();
    this.formAberto.set(true);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const bruto = this.form.getRawValue();

    try {
      await this.sociosService.salvarSocio({
        id: this.editando()?.id,
        nome: bruto.nome,
      });
      this.formAberto.set(false);
      this.aviso.sucesso('Sócio salvo.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected async confirmarExclusao(): Promise<void> {
    const socio = this.paraExcluir();
    this.paraExcluir.set(null);
    if (!socio) return;
    try {
      await this.sociosService.excluir(socio.id);
      this.aviso.sucesso('Sócio excluído.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
