import { movimentoReduzido } from '../../../shared/motion/motion';
import { AppearanceDirective } from '../../../shared/motion/appearance.directive';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensagemDeErro } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../core/services/layout.service';
import { rotaInicial } from '../../../core/services/permissoes';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

@Component({
  selector: 'pf-login',
  standalone: true,
  imports: [ReactiveFormsModule, LogoComponent, AppearanceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly isMobile = inject(LayoutService).isMobile;
  private readonly preferencias = inject(BreakpointObserver);
  protected readonly movimentoReduzido = toSignal(
    this.preferencias.observe(movimentoReduzido).pipe(map(resultado => resultado.matches)),
    { initialValue: this.preferencias.isMatched(movimentoReduzido) }
  );
  protected readonly usarImagem = signal(false);

  protected iniciarManobra(video: HTMLVideoElement): void {
    if (video.ended || !video.paused) return;
    video.play().catch(() => {
      if (video.isConnected) this.usarImagem.set(true);
    });
  }

  protected readonly erro = signal('');
  protected readonly ajudaSenha = signal(false);
  protected readonly senhaDemo = '123456';

  protected readonly form = this.fb.nonNullable.group({
    identificador: ['', [Validators.required]],
    senha: ['', [Validators.required, Validators.minLength(4)]],
  });

  protected readonly entrando = signal(false);

  protected async entrar(): Promise<void> {
    this.erro.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { identificador, senha } = this.form.getRawValue();

    this.entrando.set(true);
    try {
      if (!(await this.auth.login(identificador, senha))) {
        this.erro.set('E-mail/usuário ou senha incorretos.');
        return;
      }
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
      return;
    } finally {
      this.entrando.set(false);
    }

    const destino = this.rota.snapshot.queryParamMap.get('redirectTo') ?? rotaInicial(this.auth.nivel());
    void this.router.navigateByUrl(destino);
  }

  protected campoInvalido(nome: 'identificador' | 'senha'): boolean {
    const campo = this.form.controls[nome];
    return campo.invalid && campo.touched;
  }
}
