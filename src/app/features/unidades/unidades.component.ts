import { HistoricoAdministrativoComponent } from '../../shared/components/historico-administrativo/historico-administrativo.component';
import { MascaraDirective, telefoneValido } from '../../shared/directives/mascara.directive';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Unidade } from '../../core/models';
import { LayoutService } from '../../core/services/layout.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { ConfirmComponent } from '../../shared/components/confirm/confirm.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AvisoService } from '../../core/services/aviso.service';

@Component({
  selector: 'pf-unidades',
  standalone: true,
  imports: [HistoricoAdministrativoComponent, ReactiveFormsModule, MascaraDirective, PageHeaderComponent, IconComponent, ModalComponent, ConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades.component.html',
  styleUrl: './unidades.component.scss',
})
export class UnidadesComponent {
  private readonly unidadesService = inject(UnidadesService);
  private readonly aviso = inject(AvisoService);
  private readonly fb = inject(FormBuilder);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly unidades = this.unidadesService.unidades;

  protected readonly formAberto = signal(false);
  protected readonly editando = signal<Unidade | null>(null);
  protected readonly paraDesativar = signal<Unidade | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    endereco: ['', Validators.required],
    telefone: ['', telefoneValido],
    ativa: [true],
  });

  protected abrir(unidade?: Unidade): void {
    this.editando.set(unidade ?? null);
    this.form.reset({
      nome: unidade?.nome ?? '',
      endereco: unidade?.endereco ?? '',
      telefone: unidade?.telefone ?? '',
      ativa: unidade?.ativa ?? true,
    });
    this.formAberto.set(true);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      await this.unidadesService.salvarUnidade({ ...this.form.getRawValue(), id: this.editando()?.id });
      this.formAberto.set(false);
      this.aviso.sucesso('Unidade salva.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected async confirmarDesativacao(): Promise<void> {
    const unidade = this.paraDesativar();
    this.paraDesativar.set(null);
    if (!unidade) return;
    try {
      await this.unidadesService.desativar(unidade.id);
      this.aviso.sucesso('Unidade desativada.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
