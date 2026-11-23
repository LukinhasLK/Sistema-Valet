import { HistoricoAdministrativoComponent } from '../../shared/components/historico-administrativo/historico-administrativo.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NIVEIS_ACESSO, NivelAcesso, Usuario } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { UnidadesService } from '../../core/services/unidades.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { corDoAvatar } from '../../shared/nav-items';
import { ConfirmComponent } from '../../shared/components/confirm/confirm.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AvisoService } from '../../core/services/aviso.service';

/** Cor do badge por nível de acesso. */
const CLASSE_NIVEL: Record<NivelAcesso, string> = {
  'Proprietário': 'pf-badge--purple',
  Gerente: 'pf-badge--blue',
  Operador: 'pf-badge--gray',
};

@Component({
  selector: 'pf-usuarios',
  standalone: true,
  imports: [HistoricoAdministrativoComponent, ReactiveFormsModule, PageHeaderComponent, IconComponent, ModalComponent, ConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent {
  private readonly usuariosService = inject(UsuariosService);
  private readonly aviso = inject(AvisoService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly isMobile = inject(LayoutService).isMobile;
  protected readonly mostrarInativos = signal(false);
  protected readonly usuarios = computed(() => this.usuariosService.usuarios()
    .filter(usuario => this.mostrarInativos() || usuario.ativo !== false));
  protected readonly niveis = NIVEIS_ACESSO;
  protected readonly unidades = inject(UnidadesService).unidades;
  protected readonly salvando = signal(false);

  protected readonly formAberto = signal(false);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly paraExcluir = signal<Usuario | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    nivel: ['Operador' as NivelAcesso, Validators.required],
    senha: [''],
    unidadeIds: this.fb.nonNullable.control<number[]>([]),
  });
  protected readonly emailDuplicado = signal(false);

  protected classe(nivel: NivelAcesso): string {
    return CLASSE_NIVEL[nivel];
  }

  protected cor(nome: string): string {
    return corDoAvatar(nome);
  }

  /** O usuário da sessão não pode se excluir. */
  protected ehVoce(usuario: Usuario): boolean {
    return this.auth.usuario()?.id === usuario.id;
  }

  protected abrir(usuario?: Usuario): void {
    this.editando.set(usuario ?? null);
    this.form.reset({
      nome: usuario?.nome ?? '',
      email: usuario?.email ?? '',
      nivel: usuario?.nivel ?? 'Operador',
      senha: '',
      unidadeIds: usuario?.unidadeIds ?? [],
    });
    // Senha obrigatória só no cadastro; na edição, vazio mantém a atual.
    this.form.controls.senha.setValidators(usuario ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)]);
    this.form.controls.senha.updateValueAndValidity();
    this.emailDuplicado.set(false);
    this.formAberto.set(true);
  }

  protected alternarUnidade(id: number, selecionada: boolean): void {
    const campo = this.form.controls.unidadeIds;
    campo.setValue(selecionada ? [...campo.value, id] : campo.value.filter((unidade) => unidade !== id));
  }

  protected resumoEscopo(usuario: Usuario): string {
    if (usuario.nivel === 'Proprietário') return 'Todas as unidades';
    const ids = new Set(usuario.unidadeIds ?? []);
    return this.unidades().filter((u) => ids.has(u.id)).map((u) => u.nome).join(', ') || 'Sem acesso a unidades';
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dados = this.form.getRawValue();
    if (this.usuariosService.emailEmUso(dados.email, this.editando()?.id)) {
      this.emailDuplicado.set(true);
      return;
    }

    this.salvando.set(true);
    try {
      await this.usuariosService.salvarUsuario({ ...dados, id: this.editando()?.id });
      this.formAberto.set(false);
      this.aviso.sucesso('Usuário salvo.');
    } catch (erro) {
      this.aviso.erro(erro);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async confirmarExclusao(): Promise<void> {
    const usuario = this.paraExcluir();
    this.paraExcluir.set(null);
    if (!usuario || this.ehVoce(usuario)) return;
    try {
      await this.usuariosService.excluir(usuario.id);
      this.aviso.sucesso('Usuário desativado.');
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
