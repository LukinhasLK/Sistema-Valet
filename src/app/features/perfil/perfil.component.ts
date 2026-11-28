import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AvisoService } from '../../core/services/aviso.service';
import { mensagemDeErro } from '../../core/services/api';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { corDoAvatar } from '../../shared/nav-items';

function senhasIguais(grupo: AbstractControl): ValidationErrors | null {
  return grupo.get('novaSenha')?.value === grupo.get('confirmacao')?.value ? null : { senhasDiferentes: true };
}

@Component({
  selector: 'pf-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly aviso = inject(AvisoService);

  protected readonly usuario = this.auth.usuario;
  protected readonly inicial = this.auth.inicial;
  protected readonly mensagem = signal<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      senhaAtual: ['', Validators.required],
      novaSenha: ['', [Validators.required, Validators.minLength(6)]],
      confirmacao: ['', Validators.required],
    },
    { validators: senhasIguais }
  );

  protected cor(nome: string): string {
    return corDoAvatar(nome);
  }

  protected readonly salvando = signal(false);

  protected async trocarSenha(): Promise<void> {
    this.mensagem.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { senhaAtual, novaSenha } = this.form.getRawValue();
    this.salvando.set(true);
    try {
      await this.auth.trocarSenha(senhaAtual, novaSenha);
    } catch (erro) {
      this.mensagem.set({ tipo: 'erro', texto: mensagemDeErro(erro) });
      return;
    } finally {
      this.salvando.set(false);
    }

    this.form.reset();
    this.auth.logout();
    await this.router.navigate(['/login']);
    this.aviso.sucesso('Senha alterada. Entre com a nova senha.');
  }

  protected invalido(nome: string): boolean {
    const campo = this.form.get(nome);
    return !!campo && campo.invalid && campo.touched;
  }
}
